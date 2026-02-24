/**
 * Weekly Org Admin Summary Digest
 *
 * Runs every Friday at 06:00 UTC (end-of-week operations review).
 * For each active organization with the org_summary channel enabled:
 *   1. Gather aggregate weekly stats (roster, alerts, agent, tasks)
 *   2. Build a branded HTML ops summary email
 *   3. Send to all org_admin members via the email_queue
 *
 * Skip conditions:
 *   - Org has org_summary channel disabled in notification_settings/email
 *   - No settings document exists (default: OFF)
 *   - Org admin has no email address in their user profile
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

type WeekStats = {
  totalEnrolled: number;
  newEnrollmentsThisWeek: number;
  criticalAlerts: number;
  highAlerts: number;
  totalAlerts: number;
  openTasks: number;
  tasksCompletedThisWeek: number;
  agentCyclesRun: number;
  agentActionsTriggered: number;
  riskDistribution: {
    needsAttention: number;
    elevated: number;
    moderate: number;
    good: number;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateSafe(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

function riskBucket(score: number): keyof WeekStats["riskDistribution"] {
  if (score >= 75) return "needsAttention";
  if (score >= 55) return "elevated";
  if (score >= 30) return "moderate";
  return "good";
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildOrgSummaryHtml(params: {
  adminName: string;
  orgName: string;
  primaryColor: string;
  weekOf: string;
  stats: WeekStats;
}): { subject: string; html: string } {
  const { adminName, orgName, primaryColor, weekOf, stats } = params;
  const firstName = adminName.split(" ")[0];
  const subject = `${orgName} Weekly Ops Summary — ${weekOf}`;

  const riskBar = (label: string, count: number, color: string) =>
    count > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:13px;color:#374151">${label}</td>
          <td style="padding:6px 0;text-align:right">
            <span style="display:inline-block;background:${color};color:#FFF;border-radius:10px;padding:2px 10px;font-size:12px;font-weight:700">${count}</span>
          </td>
        </tr>`
      : "";

  const statBox = (value: string | number, label: string, color = "#111827") =>
    `<div style="background:#F9FAFB;border-radius:10px;padding:14px;text-align:center;flex:1">
      <p style="margin:0;font-size:22px;font-weight:800;color:${color}">${value}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#6B7280">${label}</p>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px">
    <div style="background:#FFF;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

      <!-- Header -->
      <div style="border-bottom:3px solid ${primaryColor};padding-bottom:14px;margin-bottom:20px">
        <h1 style="margin:0;font-size:18px;color:${primaryColor}">${orgName}</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF">Weekly Operations Summary — ${weekOf}</p>
      </div>

      <p style="font-size:16px;color:#111827">Hi ${firstName},</p>
      <p style="font-size:14px;color:#6B7280;margin-top:-4px">
        Here's your organization's operational snapshot for the past week.
      </p>

      <!-- Enrollment stats -->
      <div style="display:flex;gap:10px;margin:16px 0">
        ${statBox(stats.totalEnrolled, "Enrolled patients")}
        ${statBox(`+${stats.newEnrollmentsThisWeek}`, "New this week", stats.newEnrollmentsThisWeek > 0 ? "#2563EB" : "#6B7280")}
        ${statBox(stats.openTasks, "Open tasks", stats.openTasks > 5 ? "#F97316" : "#111827")}
      </div>

      <!-- Alert volume -->
      <div style="background:#FFF5F5;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#374151">Alert Volume</p>
        <table style="width:100%;border-collapse:collapse">
          ${riskBar("Critical alerts", stats.criticalAlerts, "#DC2626")}
          ${riskBar("High priority alerts", stats.highAlerts, "#F97316")}
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#374151;border-top:1px solid #FED7D7">Total alerts</td>
            <td style="padding:6px 0;text-align:right;border-top:1px solid #FED7D7">
              <span style="font-size:13px;font-weight:700;color:#374151">${stats.totalAlerts}</span>
            </td>
          </tr>
        </table>
        ${
          stats.criticalAlerts === 0 && stats.highAlerts === 0
            ? `<p style="margin:10px 0 0;font-size:12px;color:#15803D">✅ No critical or high alerts this week.</p>`
            : ""
        }
      </div>

      <!-- Risk distribution -->
      <div style="margin:16px 0">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#374151">Patient Risk Distribution</p>
        <table style="width:100%;border-collapse:collapse">
          ${riskBar("Needs attention", stats.riskDistribution.needsAttention, "#DC2626")}
          ${riskBar("Elevated", stats.riskDistribution.elevated, "#F59E0B")}
          ${riskBar("Moderate", stats.riskDistribution.moderate, "#3B82F6")}
          ${riskBar("Good", stats.riskDistribution.good, "#10B981")}
        </table>
      </div>

      <!-- AI agent stats -->
      <div style="background:#EEF2FF;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#4338CA">AI Agent Activity</p>
        <div style="display:flex;gap:10px">
          ${statBox(stats.agentCyclesRun, "Cycles run", "#4338CA")}
          ${statBox(stats.agentActionsTriggered, "Actions taken", "#4338CA")}
          ${statBox(stats.tasksCompletedThisWeek, "Tasks completed", "#059669")}
        </div>
      </div>

      <!-- CTA -->
      <div style="margin-top:20px;padding:14px;background:#EFF6FF;border-radius:10px">
        <p style="margin:0;font-size:13px;color:#1D4ED8">
          Open the Maak portal to drill into individual patient timelines,
          review open tasks, and adjust care pathways.
        </p>
      </div>
    </div>

    <div style="margin-top:20px;text-align:center;font-size:12px;color:#9CA3AF">
      <p>Sent to org administrators of ${orgName} via Maak Health.</p>
      <p>© ${new Date().getFullYear()} Maak Health.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// ─── Stats Gatherer ───────────────────────────────────────────────────────────

async function gatherWeekStats(
  orgId: string,
  weekCutoff: Timestamp
): Promise<WeekStats> {
  const [rosterSnap, newRosterSnap, alertSnap, taskSnap, completedTaskSnap] =
    await Promise.all([
      // All enrolled patients
      db()
        .collection("patient_roster")
        .where("orgId", "==", orgId)
        .where("status", "==", "active")
        .get(),

      // New enrollments this week
      db()
        .collection("patient_roster")
        .where("orgId", "==", orgId)
        .where("enrolledAt", ">=", weekCutoff)
        .get(),

      // Alerts this week for any patient in this org
      db()
        .collection("alerts")
        .where("orgId", "==", orgId)
        .where("timestamp", ">=", weekCutoff)
        .get(),

      // Open tasks for this org
      db()
        .collection("tasks")
        .where("orgId", "==", orgId)
        .where("status", "in", ["open", "in_progress"])
        .get(),

      // Tasks completed this week
      db()
        .collection("tasks")
        .where("orgId", "==", orgId)
        .where("status", "==", "completed")
        .where("completedAt", ">=", weekCutoff)
        .get(),
    ]);

  // Risk distribution from roster
  const riskDist: WeekStats["riskDistribution"] = {
    needsAttention: 0,
    elevated: 0,
    moderate: 0,
    good: 0,
  };
  for (const doc of rosterSnap.docs) {
    const score = (doc.data().riskScore as number) ?? 0;
    riskDist[riskBucket(score)]++;
  }

  // Alert severity breakdown
  let criticalAlerts = 0;
  let highAlerts = 0;
  for (const doc of alertSnap.docs) {
    const sev = doc.data().severity as string;
    if (sev === "critical") criticalAlerts++;
    else if (sev === "high") highAlerts++;
  }

  // Agent activity: sum openActionsCount from agent state docs for this org
  // We approximate by querying patient_agent_state docs updated this week
  const agentStateSnap = await db()
    .collection("patient_agent_state")
    .where("orgId", "==", orgId)
    .where("lastCycleAt", ">=", weekCutoff)
    .get();

  const agentCyclesRun = agentStateSnap.size;
  let agentActionsTriggered = 0;
  for (const doc of agentStateSnap.docs) {
    const history = (doc.data().actionHistory as unknown[]) ?? [];
    // Count actions logged this week
    for (const entry of history) {
      const ts = (entry as { timestamp?: unknown }).timestamp;
      if (ts && toDateSafe(ts) >= toDateSafe(weekCutoff)) {
        agentActionsTriggered++;
      }
    }
  }

  return {
    totalEnrolled: rosterSnap.size,
    newEnrollmentsThisWeek: newRosterSnap.size,
    criticalAlerts,
    highAlerts,
    totalAlerts: alertSnap.size,
    openTasks: taskSnap.size,
    tasksCompletedThisWeek: completedTaskSnap.size,
    agentCyclesRun,
    agentActionsTriggered,
    riskDistribution: riskDist,
  };
}

// ─── Scheduled Job ────────────────────────────────────────────────────────────

/**
 * Fires every Friday at 06:00 UTC.
 * Sends a weekly operations digest to all org_admin members of each
 * organization that has the org_summary email channel enabled.
 */
export const weeklyOrgSummary = onSchedule(
  {
    schedule: "every friday 06:00",
    timeZone: "UTC",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = createTraceId();
    const weekCutoff = Timestamp.fromDate(
      new Date(Date.now() - 7 * 24 * 3600 * 1000)
    );
    const weekOf = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    logger.info("orgSummary: started", {
      traceId,
      weekOf,
      fn: "weeklyOrgSummary",
    });

    try {
      // Get all active organizations
      const orgsSnap = await db()
        .collection("organizations")
        .where("status", "==", "active")
        .limit(500)
        .get();

      let totalQueued = 0;
      let totalSkipped = 0;

      for (const orgDoc of orgsSnap.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();

        // Check if org_summary channel is enabled
        const notifSnap = await db()
          .collection("organizations")
          .doc(orgId)
          .collection("notification_settings")
          .doc("email")
          .get();

        if (!notifSnap.exists) {
          totalSkipped++;
          continue;
        }

        const channels = notifSnap.data()!.channels as
          | Record<string, boolean>
          | undefined;
        if (!channels?.["org_summary"]) {
          totalSkipped++;
          continue;
        }

        // Get org_admin members
        const adminSnap = await db()
          .collection("organizations")
          .doc(orgId)
          .collection("members")
          .where("role", "==", "org_admin")
          .get();

        if (adminSnap.empty) {
          totalSkipped++;
          continue;
        }

        // Gather weekly stats
        let stats: WeekStats;
        try {
          stats = await gatherWeekStats(orgId, weekCutoff);
        } catch (err) {
          logger.error("orgSummary: failed to gather stats", err as Error, {
            traceId,
            orgId,
            fn: "weeklyOrgSummary",
          });
          totalSkipped++;
          continue;
        }

        // Skip orgs with zero enrolled patients
        if (stats.totalEnrolled === 0) {
          totalSkipped++;
          continue;
        }

        const orgName = (orgData.name as string) ?? orgId;
        const primaryColor =
          (orgData.settings?.branding?.primaryColor as string) ?? "#2563EB";

        // Fetch admin user profiles and queue emails
        const adminUserIds = adminSnap.docs.map(
          (d) => d.data().userId as string
        );

        const adminResults = await Promise.allSettled(
          adminUserIds.map((uid) => db().collection("users").doc(uid).get())
        );

        const emails: string[] = [];
        for (const result of adminResults) {
          if (result.status !== "fulfilled") continue;
          const snap = result.value;
          if (!snap.exists) continue;
          const email = snap.data()!.email as string | undefined;
          if (email) emails.push(email);
        }

        if (emails.length === 0) {
          totalSkipped++;
          continue;
        }

        // Pick a representative admin name for the greeting
        const firstAdminSnap = adminResults.find(
          (r) => r.status === "fulfilled" && r.value.exists
        );
        const firstAdminData =
          firstAdminSnap?.status === "fulfilled"
            ? firstAdminSnap.value.data()
            : undefined;
        const adminName =
          (firstAdminData?.displayName as string) ??
          (firstAdminData?.name as string) ??
          "Admin";

        const { subject, html } = buildOrgSummaryHtml({
          adminName,
          orgName,
          primaryColor,
          weekOf,
          stats,
        });

        await db().collection("email_queue").add({
          to: emails,
          subject,
          bodyHtml: html,
          channel: "org_summary",
          orgId,
          status: "pending",
          attempts: 0,
          sentAt: null,
          error: null,
          createdAt: FieldValue.serverTimestamp(),
        });

        totalQueued++;

        logger.info("orgSummary: queued for org", {
          traceId,
          orgId,
          adminCount: emails.length,
          fn: "weeklyOrgSummary",
        });
      }

      logger.info("orgSummary: completed", {
        traceId,
        totalQueued,
        totalSkipped,
        fn: "weeklyOrgSummary",
      });
    } catch (err) {
      logger.error("orgSummary: top-level failure", err as Error, {
        traceId,
        fn: "weeklyOrgSummary",
      });
    }
  }
);
