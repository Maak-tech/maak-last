/**
 * Critical Alert Email Trigger
 *
 * Fires on every new document written to `alerts/{alertId}`.
 * When the alert has `severity === "critical"` and belongs to an org:
 *   1. Check if the org has the `critical_alert` email channel enabled.
 *   2. Fetch all org_admin + provider members with email addresses.
 *   3. Build a branded HTML alert email.
 *   4. Write to `email_queue` for SendGrid delivery.
 *
 * This closes the notification loop — push is fired immediately by the
 * app / escalation service; email provides a durable fallback that
 * survives push-token misses and app-killed sessions.
 *
 * Skip conditions:
 *   - severity !== "critical"
 *   - alert has no orgId (family-only alert, no org context)
 *   - org notification_settings/email doesn't have critical_alert: true
 *   - no provider/admin emails found
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateSafe(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

/** Capitalise first letter, replace underscores with spaces. */
function humaniseVitalType(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildCriticalAlertHtml(params: {
  patientName: string;
  vitalType: string;
  alertValue?: string | number;
  alertMessage?: string;
  orgName: string;
  primaryColor: string;
  alertId: string;
  timestamp: Date;
}): { subject: string; html: string } {
  const {
    patientName,
    vitalType,
    alertValue,
    alertMessage,
    orgName,
    alertId,
    timestamp,
  } = params;

  const timeStr = timestamp.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  const subject = `🚨 Critical Alert: ${patientName} — ${vitalType}`;

  const valueBlock =
    alertValue !== undefined
      ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.8px">Measured Value</p>
         <p style="margin:0 0 16px;font-size:28px;font-weight:800;color:#DC2626">${alertValue}</p>`
      : "";

  const messageBlock = alertMessage
    ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.8px">Details</p>
       <p style="margin:0;font-size:14px;color:#374151">${alertMessage}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FEF2F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px">
    <div style="background:#FFF;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-top:4px solid #DC2626">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:56px;height:56px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">
          🚨
        </div>
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:800;color:#DC2626">Critical Health Alert</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF">${orgName} · ${timeStr}</p>
        </div>
      </div>

      <!-- Alert Card -->
      <div style="background:#FEF2F2;border:2px solid #FECACA;border-radius:12px;padding:20px;margin:0 0 20px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.8px">Patient</p>
        <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827">${patientName}</p>

        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.8px">Alert Type</p>
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#374151">${vitalType}</p>

        ${valueBlock}
        ${messageBlock}
      </div>

      <!-- Action prompt -->
      <div style="background:#EFF6FF;border-radius:10px;padding:14px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#1D4ED8">
          Open the Nuralix portal to view this patient's full vitals timeline,
          acknowledge this alert, and coordinate care with your team.
        </p>
      </div>

      <p style="margin:0;font-size:11px;color:#9CA3AF">Alert ID: ${alertId}</p>
    </div>

    <div style="margin-top:20px;text-align:center;font-size:12px;color:#9CA3AF">
      <p>Sent to clinical team of <strong>${orgName}</strong> via Nuralix.</p>
      <p>© ${new Date().getFullYear()} Nuralix. This alert was generated automatically.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

/**
 * Fires on every new alert document.
 * Emails all org providers + admins for critical-severity org alerts
 * when the `critical_alert` channel is enabled on the organization.
 */
export const criticalAlertEmail = onDocumentCreated(
  {
    document: "alerts/{alertId}",
    timeoutSeconds: 30,
    memory: "128MiB",
  },
  async (event) => {
    const traceId = createTraceId();
    const alertId = event.params.alertId;
    const data = event.data?.data();

    if (!data) return;

    // Only process critical-severity alerts belonging to an org
    const severity = data.severity as string | undefined;
    const orgId = data.orgId as string | undefined;

    if (severity !== "critical" || !orgId) return;

    logger.info("criticalAlertEmail: processing", {
      traceId,
      alertId,
      orgId,
      fn: "criticalAlertEmail",
    });

    // ─── 1. Check org critical_alert channel ──────────────────────────────

    const notifSnap = await db()
      .collection("organizations")
      .doc(orgId)
      .collection("notification_settings")
      .doc("email")
      .get();

    if (!notifSnap.exists) {
      logger.debug("criticalAlertEmail: no email settings doc, skipping", {
        traceId,
        alertId,
        orgId,
        fn: "criticalAlertEmail",
      });
      return;
    }

    const channels = notifSnap.data()!.channels as
      | Record<string, boolean>
      | undefined;

    if (!channels?.["critical_alert"]) {
      logger.debug("criticalAlertEmail: channel disabled, skipping", {
        traceId,
        alertId,
        orgId,
        fn: "criticalAlertEmail",
      });
      return;
    }

    // ─── 2. Gather org + members ──────────────────────────────────────────

    const [orgSnap, membersSnap] = await Promise.all([
      db().collection("organizations").doc(orgId).get(),
      db()
        .collection("organizations")
        .doc(orgId)
        .collection("members")
        .where("role", "in", ["org_admin", "provider"])
        .where("isActive", "==", true)
        .get(),
    ]);

    if (!orgSnap.exists || membersSnap.empty) {
      logger.info("criticalAlertEmail: no org or no active providers", {
        traceId,
        alertId,
        orgId,
        fn: "criticalAlertEmail",
      });
      return;
    }

    const orgData = orgSnap.data()!;
    const orgName = (orgData.name as string) ?? orgId;
    const primaryColor =
      (orgData.settings?.branding?.primaryColor as string) ?? "#DC2626";

    // ─── 3. Collect provider email addresses ──────────────────────────────

    const memberUserIds = membersSnap.docs.map(
      (d) => d.data().userId as string
    );

    const userResults = await Promise.allSettled(
      memberUserIds.map((uid) => db().collection("users").doc(uid).get())
    );

    const emails: string[] = [];
    for (const result of userResults) {
      if (result.status !== "fulfilled" || !result.value.exists) continue;
      const email = result.value.data()!.email as string | undefined;
      if (email) emails.push(email);
    }

    if (emails.length === 0) {
      logger.info("criticalAlertEmail: no provider emails found", {
        traceId,
        alertId,
        orgId,
        fn: "criticalAlertEmail",
      });
      return;
    }

    // ─── 4. Resolve patient name ──────────────────────────────────────────

    const patientUserId = data.userId as string | undefined;
    let patientName = "Patient";

    if (patientUserId) {
      try {
        const patientSnap = await db()
          .collection("users")
          .doc(patientUserId)
          .get();
        if (patientSnap.exists) {
          const pd = patientSnap.data()!;
          patientName =
            (pd.displayName as string) ?? (pd.name as string) ?? patientUserId;
        }
      } catch {
        // Non-fatal; use "Patient" fallback
      }
    }

    // ─── 5. Build and queue email ─────────────────────────────────────────

    const rawVitalType =
      (data.vitalType as string) ?? (data.type as string) ?? "vital";
    const vitalType = humaniseVitalType(rawVitalType);
    const alertMessage = data.message as string | undefined;
    const alertValue = data.value as string | number | undefined;
    const timestamp = toDateSafe(data.timestamp);

    const { subject, html } = buildCriticalAlertHtml({
      patientName,
      vitalType,
      alertValue,
      alertMessage,
      orgName,
      primaryColor,
      alertId,
      timestamp,
    });

    await db()
      .collection("email_queue")
      .add({
        to: emails,
        subject,
        bodyHtml: html,
        channel: "critical_alert",
        orgId,
        patientUserId: patientUserId ?? null,
        alertId,
        status: "pending",
        attempts: 0,
        sentAt: null,
        error: null,
        createdAt: FieldValue.serverTimestamp(),
      });

    logger.info("criticalAlertEmail: queued", {
      traceId,
      alertId,
      orgId,
      patientName,
      recipientCount: emails.length,
      fn: "criticalAlertEmail",
    });
  }
);
