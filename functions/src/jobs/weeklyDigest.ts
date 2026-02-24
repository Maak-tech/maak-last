/**
 * Weekly Provider Digest Job
 *
 * Runs every Monday at 07:00 UTC.
 * For each active organization:
 *   1. Load the provider + org_admin member list
 *   2. Compute a population health summary (critical/high counts, alert count)
 *   3. Identify the top at-risk patients
 *   4. Queue a branded weekly digest email to each provider
 *
 * Email delivery is handled by the processEmailQueue Cloud Function trigger
 * (functions/src/triggers/emailQueue.ts) which picks up pending jobs and
 * sends via SendGrid.
 *
 * Skip conditions:
 *   - Org has no enrolled active patients
 *   - Org feature flag "weekly_email_digest" not enabled
 *   - Member has no email address in their user profile
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } from "../secrets";

const db = () => getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

type RosterEntry = {
  userId: string;
  orgId: string;
  riskScore: number;
  status: string;
};

type MemberEntry = {
  userId: string;
  role: string;
  email?: string;
  displayName?: string;
};

type PatientSummaryRow = {
  name: string;
  riskLevel: string;
  lastSync: string;
  anomalyCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLevelFromScore(score: number): string {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "elevated";
  return "normal";
}

function toDateSafe(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (hours < 1) return "< 1 hour ago";
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Send via SendGrid REST API directly from the job (no email_queue roundtrip)
 * since the Cloud Function already has the secret injected.
 */
async function sendViaApi(params: {
  apiKey: string;
  fromEmail: string;
  to: string;
  subject: string;
  bodyHtml: string;
}): Promise<void> {
  const payload = {
    personalizations: [{ to: [{ email: params.to }] }],
    from: { email: params.fromEmail, name: "Maak Health" },
    subject: params.subject,
    content: [{ type: "text/html", value: params.bodyHtml }],
  };

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`SendGrid ${response.status}: ${body}`);
  }
}

// ─── HTML Template ─────────────────────────────────────────────────────────────

function buildDigestHtml(params: {
  orgName: string;
  primaryColor: string;
  providerName: string;
  weekOf: string;
  totalPatients: number;
  criticalCount: number;
  highRiskCount: number;
  alertCount: number;
  topPatients: PatientSummaryRow[];
}): { subject: string; html: string } {
  const {
    orgName,
    primaryColor,
    providerName,
    weekOf,
    totalPatients,
    criticalCount,
    highRiskCount,
    alertCount,
    topPatients,
  } = params;

  const subject = `[${orgName}] Weekly Patient Summary — ${weekOf}`;

  const patientRows = topPatients
    .map((p) => {
      const badgeColor =
        p.riskLevel === "critical"
          ? "#DC2626"
          : p.riskLevel === "high"
            ? "#D97706"
            : "#059669";
      const badgeBg =
        p.riskLevel === "critical"
          ? "#FEE2E2"
          : p.riskLevel === "high"
            ? "#FEF3C7"
            : "#D1FAE5";
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">${p.name}</td>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">
          <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${badgeBg};color:${badgeColor}">
            ${p.riskLevel}
          </span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">${p.anomalyCount}</td>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px;color:#6B7280">${p.lastSync}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

      <div style="border-bottom:3px solid ${primaryColor};padding-bottom:16px;margin-bottom:24px">
        <h1 style="margin:0;font-size:20px;color:${primaryColor}">${orgName}</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#6B7280">Weekly Patient Summary — ${weekOf}</p>
      </div>

      <p style="font-size:15px;color:#374151">Hello ${providerName},</p>
      <p style="font-size:14px;color:#6B7280;margin-top:-4px">
        Here's your weekly overview of patients enrolled under <strong>${orgName}</strong>.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <th style="text-align:left;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #E5E7EB">Metric</th>
          <th style="text-align:left;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #E5E7EB">Count</th>
        </tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">Total active patients</td><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:600">${totalPatients}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">Critical risk</td><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:600;color:#DC2626">${criticalCount}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">High risk</td><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:600;color:#D97706">${highRiskCount}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px">New alerts this week</td><td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:600">${alertCount}</td></tr>
      </table>

      ${
        topPatients.length > 0
          ? `<h3 style="font-size:15px;margin-bottom:8px;color:#111827">Patients needing attention</h3>
             <table style="width:100%;border-collapse:collapse">
               <tr>
                 <th style="text-align:left;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #E5E7EB">Patient</th>
                 <th style="text-align:left;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #E5E7EB">Risk</th>
                 <th style="text-align:left;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #E5E7EB">Anomalies</th>
                 <th style="text-align:left;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #E5E7EB">Last Sync</th>
               </tr>
               ${patientRows}
             </table>`
          : `<p style="font-size:14px;color:#059669;font-weight:600">No high-risk patients this week — great work!</p>`
      }

      <div style="margin-top:24px;padding:14px;background:#EFF6FF;border-radius:8px">
        <p style="margin:0;font-size:13px;color:#1D4ED8">
          Log in to the Maak dashboard to review alerts, complete tasks, and view full patient timelines.
        </p>
      </div>
    </div>

    <div style="margin-top:24px;text-align:center;font-size:12px;color:#9CA3AF">
      <p>This email was sent by ${orgName} via Maak Health. Do not reply.</p>
      <p>© ${new Date().getFullYear()} Maak Health. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// ─── Per-org processing ───────────────────────────────────────────────────────

async function processOrg(
  orgId: string,
  orgName: string,
  primaryColor: string,
  apiKey: string,
  fromEmail: string,
  weekOf: string,
  traceId: string
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  // Roster: all active patients
  const rosterSnap = await db()
    .collection("patient_roster")
    .where("orgId", "==", orgId)
    .where("status", "==", "active")
    .get();

  if (rosterSnap.empty) {
    logger.debug("weeklyDigest: no active patients, skipping org", {
      traceId,
      orgId,
      fn: "processOrg",
    });
    return { sent: 0, skipped: 0 };
  }

  const roster: RosterEntry[] = rosterSnap.docs.map((d) => ({
    userId: d.data().userId as string,
    orgId,
    riskScore: (d.data().riskScore as number) ?? 0,
    status: d.data().status as string,
  }));

  // Compute stats from roster risk scores
  const totalPatients = roster.length;
  const criticalCount = roster.filter((r) => r.riskScore >= 75).length;
  const highRiskCount = roster.filter(
    (r) => r.riskScore >= 55 && r.riskScore < 75
  ).length;

  // Alert count: anomalies in last 7 days across all patients
  const weekCutoff = Timestamp.fromDate(
    new Date(Date.now() - 7 * 24 * 3600 * 1000)
  );
  let alertCount = 0;
  for (const entry of roster.slice(0, 50)) {
    // Cap to avoid excessive reads
    const aSnap = await db()
      .collection("users")
      .doc(entry.userId)
      .collection("anomalies")
      .where("detectedAt", ">=", weekCutoff)
      .get();
    alertCount += aSnap.size;
  }

  // Top 5 at-risk patients
  const sorted = [...roster].sort((a, b) => b.riskScore - a.riskScore);
  const topRoster = sorted.filter((r) => r.riskScore >= 45).slice(0, 5);

  const topPatients: PatientSummaryRow[] = await Promise.all(
    topRoster.map(async (entry) => {
      const [userSnap, recentVital, anomalySnap] = await Promise.all([
        db().collection("users").doc(entry.userId).get(),
        db()
          .collection("vitals")
          .where("userId", "==", entry.userId)
          .orderBy("timestamp", "desc")
          .limit(1)
          .get(),
        db()
          .collection("users")
          .doc(entry.userId)
          .collection("anomalies")
          .where("detectedAt", ">=", weekCutoff)
          .get(),
      ]);

      const userData = userSnap.data();
      const name: string =
        (userData?.displayName as string) ??
        (userData?.name as string) ??
        `Patient ${entry.userId.slice(0, 6)}`;

      const lastSyncDate: Date = recentVital.empty
        ? new Date(0)
        : toDateSafe(recentVital.docs[0].data().timestamp);

      return {
        name,
        riskLevel: riskLevelFromScore(entry.riskScore),
        lastSync:
          lastSyncDate.getTime() === 0 ? "Never" : formatRelative(lastSyncDate),
        anomalyCount: anomalySnap.size,
      };
    })
  );

  // Members: providers + org_admins with emails
  const membersSnap = await db()
    .collection("organizations")
    .doc(orgId)
    .collection("members")
    .where("role", "in", ["org_admin", "provider"])
    .where("isActive", "==", true)
    .get();

  const members: MemberEntry[] = [];
  for (const memberDoc of membersSnap.docs) {
    const memberData = memberDoc.data();
    const userId = memberData.userId as string;
    // Get email from user profile
    const userSnap = await db().collection("users").doc(userId).get();
    const email =
      (userSnap.data()?.email as string | undefined) ??
      (memberData.email as string | undefined);
    if (!email) continue;

    members.push({
      userId,
      role: memberData.role as string,
      email,
      displayName:
        (userSnap.data()?.displayName as string | undefined) ??
        (memberData.displayName as string | undefined) ??
        email,
    });
  }

  if (members.length === 0) {
    logger.debug("weeklyDigest: no provider emails found for org", {
      traceId,
      orgId,
      fn: "processOrg",
    });
    return { sent: 0, skipped: 0 };
  }

  // Send to each provider
  for (const member of members) {
    try {
      const { subject, html } = buildDigestHtml({
        orgName,
        primaryColor,
        providerName: member.displayName ?? member.email ?? "Provider",
        weekOf,
        totalPatients,
        criticalCount,
        highRiskCount,
        alertCount,
        topPatients,
      });

      await sendViaApi({
        apiKey,
        fromEmail,
        to: member.email!,
        subject,
        bodyHtml: html,
      });

      // Log delivery in email_queue collection for diagnostics
      await db()
        .collection("email_queue")
        .add({
          to: [member.email],
          subject,
          channel: "weekly_report",
          orgId,
          status: "sent",
          attempts: 1,
          sentAt: FieldValue.serverTimestamp(),
          error: null,
          bodyHtml: null, // omit from log to save space
          createdAt: FieldValue.serverTimestamp(),
        });

      sent++;
      logger.info("weeklyDigest: sent to provider", {
        traceId,
        orgId,
        email: member.email,
        fn: "processOrg",
      });
    } catch (err) {
      skipped++;
      logger.error("weeklyDigest: failed to send to provider", err as Error, {
        traceId,
        orgId,
        email: member.email,
        fn: "processOrg",
      });
    }
  }

  return { sent, skipped };
}

// ─── Scheduled Job ─────────────────────────────────────────────────────────────

/**
 * Fires every Monday at 07:00 UTC.
 * Iterates all active organizations and sends weekly provider digest emails.
 */
export const weeklyProviderDigest = onSchedule(
  {
    schedule: "every monday 07:00",
    timeZone: "UTC",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async () => {
    const traceId = createTraceId();
    const weekOf = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    logger.info("weeklyDigest: started", {
      traceId,
      weekOf,
      fn: "weeklyProviderDigest",
    });

    try {
      const orgsSnap = await db().collection("organizations").get();

      const apiKey = SENDGRID_API_KEY.value();
      const fromEmail = SENDGRID_FROM_EMAIL.value() || "noreply@maakhealth.com";

      let totalSent = 0;
      let totalSkipped = 0;

      for (const orgDoc of orgsSnap.docs) {
        const org = orgDoc.data();
        const orgId = orgDoc.id;
        const orgName = (org.name as string) ?? orgId;

        // Check notification settings (weekly_report channel toggle)
        const notifSnap = await db()
          .collection("organizations")
          .doc(orgId)
          .collection("notification_settings")
          .doc("email")
          .get();

        if (notifSnap.exists) {
          const notifData = notifSnap.data()!;
          const notifChannels = notifData.channels as
            | Record<string, boolean>
            | undefined;
          if (notifChannels && notifChannels["weekly_report"] === false) {
            logger.debug("weeklyDigest: weekly_report disabled for org", {
              traceId,
              orgId,
              fn: "weeklyProviderDigest",
            });
            continue;
          }
        }

        const primaryColor: string =
          (org.settings?.branding?.primaryColor as string) ?? "#2563EB";

        try {
          const { sent, skipped } = await processOrg(
            orgId,
            orgName,
            primaryColor,
            apiKey,
            fromEmail,
            weekOf,
            traceId
          );
          totalSent += sent;
          totalSkipped += skipped;
        } catch (err) {
          logger.error("weeklyDigest: org processing failed", err as Error, {
            traceId,
            orgId,
            fn: "weeklyProviderDigest",
          });
        }
      }

      logger.info("weeklyDigest: completed", {
        traceId,
        totalOrgs: orgsSnap.size,
        totalSent,
        totalSkipped,
        fn: "weeklyProviderDigest",
      });
    } catch (err) {
      logger.error("weeklyDigest: top-level failure", err as Error, {
        traceId,
        fn: "weeklyProviderDigest",
      });
    }
  }
);
