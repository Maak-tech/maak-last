/**
 * Weekly Patient Digest Job
 *
 * Runs every Sunday at 08:00 UTC.
 * For each patient enrolled in at least one active org:
 *   1. Gather the past week's health summary (vitals, anomalies, meds)
 *   2. Build a personalized HTML email
 *   3. Queue to email_queue (SendGrid pickup via processEmailQueue trigger)
 *
 * Skip conditions:
 *   - Org has patient_digest channel disabled in notification_settings/email
 *   - Patient has no email address in their profile
 *   - Patient has no active org enrollment
 *   - No health data logged this week (no point sending an empty digest)
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

type WeekSummary = {
  vitalReadings: number;
  anomalyCount: number;
  missedMedCount: number;
  activeMedCount: number;
  avgHeartRate?: number;
  avgSpO2?: number;
  riskLevel: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLevelFromScore(score: number): string {
  if (score >= 75) return "needs attention";
  if (score >= 55) return "elevated";
  if (score >= 30) return "moderate";
  return "good";
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildPatientDigestHtml(params: {
  patientName: string;
  orgName: string;
  primaryColor: string;
  weekOf: string;
  summary: WeekSummary;
}): { subject: string; html: string } {
  const { patientName, orgName, primaryColor, weekOf, summary } = params;

  const firstName = patientName.split(" ")[0];
  const subject = `Your Weekly Health Summary — ${weekOf}`;

  const riskBadgeColor =
    summary.riskLevel === "needs attention"
      ? { bg: "#FEE2E2", text: "#DC2626" }
      : summary.riskLevel === "elevated"
        ? { bg: "#FEF3C7", text: "#D97706" }
        : { bg: "#D1FAE5", text: "#059669" };

  const vitalRows =
    summary.avgHeartRate || summary.avgSpO2
      ? `<table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr>
            <th style="text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;padding:6px 0;border-bottom:1px solid #E5E7EB">Metric</th>
            <th style="text-align:right;font-size:12px;color:#6B7280;text-transform:uppercase;padding:6px 0;border-bottom:1px solid #E5E7EB">Weekly Avg</th>
          </tr>
          ${summary.avgHeartRate ? `<tr><td style="padding:8px 0;font-size:14px;border-bottom:1px solid #F3F4F6">Heart Rate</td><td style="padding:8px 0;font-size:14px;text-align:right;border-bottom:1px solid #F3F4F6"><strong>${Math.round(summary.avgHeartRate)} bpm</strong></td></tr>` : ""}
          ${summary.avgSpO2 ? `<tr><td style="padding:8px 0;font-size:14px;border-bottom:1px solid #F3F4F6">Oxygen Saturation</td><td style="padding:8px 0;font-size:14px;text-align:right;border-bottom:1px solid #F3F4F6"><strong>${Math.round(summary.avgSpO2)}%</strong></td></tr>` : ""}
        </table>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#FFF;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

      <div style="border-bottom:3px solid ${primaryColor};padding-bottom:14px;margin-bottom:20px">
        <h1 style="margin:0;font-size:18px;color:${primaryColor}">${orgName}</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF">Weekly Health Summary — ${weekOf}</p>
      </div>

      <p style="font-size:16px;color:#111827">Hi ${firstName},</p>
      <p style="font-size:14px;color:#6B7280;margin-top:-4px">
        Here's a snapshot of your health activity this week, monitored by ${orgName}.
      </p>

      <!-- Overall status -->
      <div style="background:${riskBadgeColor.bg};border-radius:12px;padding:14px;margin:16px 0;display:flex;align-items:center;gap:10px">
        <div style="font-size:22px">
          ${summary.riskLevel === "needs attention" ? "⚠️" : summary.riskLevel === "elevated" ? "📊" : "✅"}
        </div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:700;color:${riskBadgeColor.text}">Overall: ${summary.riskLevel.charAt(0).toUpperCase() + summary.riskLevel.slice(1)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:${riskBadgeColor.text}">
            ${summary.vitalReadings} vital readings logged this week
          </p>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0">
        <div style="background:#F9FAFB;border-radius:10px;padding:12px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:800;color:#111827">${summary.vitalReadings}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6B7280">Vital readings</p>
        </div>
        <div style="background:#F9FAFB;border-radius:10px;padding:12px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:800;color:${summary.anomalyCount > 0 ? "#EF4444" : "#10B981"}">${summary.anomalyCount}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6B7280">Anomalies detected</p>
        </div>
        <div style="background:#F9FAFB;border-radius:10px;padding:12px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:800;color:${summary.missedMedCount > 0 ? "#F97316" : "#10B981"}">${summary.missedMedCount}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6B7280">Missed doses</p>
        </div>
        <div style="background:#F9FAFB;border-radius:10px;padding:12px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:800;color:#111827">${summary.activeMedCount}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6B7280">Active medications</p>
        </div>
      </div>

      ${vitalRows}

      ${
        summary.missedMedCount > 0
          ? `
      <div style="background:#FEF3C7;border-radius:10px;padding:12px;margin:12px 0">
        <p style="margin:0;font-size:13px;color:#92400E">
          <strong>Reminder:</strong> You missed ${summary.missedMedCount} medication dose${summary.missedMedCount > 1 ? "s" : ""} this week.
          Staying on schedule helps your care team better support you.
        </p>
      </div>`
          : ""
      }

      <div style="margin-top:20px;padding:14px;background:#EFF6FF;border-radius:10px">
        <p style="margin:0;font-size:13px;color:#1D4ED8">
          Open the Nuralix app to review your detailed readings, log symptoms,
          or message your care coordinator.
        </p>
      </div>
    </div>

    <div style="margin-top:20px;text-align:center;font-size:12px;color:#9CA3AF">
      <p>Sent by ${orgName} via Nuralix. To unsubscribe, update your notification preferences in the app.</p>
      <p>© ${new Date().getFullYear()} Nuralix.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// ─── Per-patient processing ───────────────────────────────────────────────────

async function processPatient(
  userId: string,
  orgId: string,
  orgName: string,
  primaryColor: string,
  weekCutoff: Timestamp,
  weekOf: string,
  traceId: string
): Promise<boolean> {
  // Get patient profile + email
  const userSnap = await db().collection("users").doc(userId).get();
  if (!userSnap.exists) return false;

  const userData = userSnap.data()!;
  const email = userData.email as string | undefined;
  if (!email) return false;

  const patientName: string =
    (userData.displayName as string) ?? (userData.name as string) ?? email;

  // Gather week's health data in parallel
  const [vitalSnap, anomalySnap, medSnap, rosterSnap] = await Promise.all([
    db()
      .collection("vitals")
      .where("userId", "==", userId)
      .where("timestamp", ">=", weekCutoff)
      .get(),

    db()
      .collection("users")
      .doc(userId)
      .collection("anomalies")
      .where("detectedAt", ">=", weekCutoff)
      .get(),

    db()
      .collection("medications")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .get(),

    db().collection("patient_roster").doc(`${orgId}_${userId}`).get(),
  ]);

  // Skip if no activity this week
  if (vitalSnap.empty && anomalySnap.empty) return false;

  // Compute averages from vitals
  let heartRateSum = 0;
  let heartRateCount = 0;
  let spO2Sum = 0;
  let spO2Count = 0;

  for (const doc of vitalSnap.docs) {
    const d = doc.data();
    if (d.type === "heart_rate" && typeof d.value === "number") {
      heartRateSum += d.value;
      heartRateCount++;
    } else if (d.type === "oxygen_saturation" && typeof d.value === "number") {
      spO2Sum += d.value;
      spO2Count++;
    }
  }

  // Missed meds: medications with lastMissedAt within the week
  const missedMedSnap = await db()
    .collection("medications")
    .where("userId", "==", userId)
    .where("isActive", "==", true)
    .where("lastMissedAt", ">=", weekCutoff)
    .get();

  const riskScore = (rosterSnap.data()?.riskScore as number) ?? 0;

  const summary: WeekSummary = {
    vitalReadings: vitalSnap.size,
    anomalyCount: anomalySnap.size,
    missedMedCount: missedMedSnap.size,
    activeMedCount: medSnap.size,
    avgHeartRate:
      heartRateCount > 0 ? heartRateSum / heartRateCount : undefined,
    avgSpO2: spO2Count > 0 ? spO2Sum / spO2Count : undefined,
    riskLevel: riskLevelFromScore(riskScore),
  };

  const { subject, html } = buildPatientDigestHtml({
    patientName,
    orgName,
    primaryColor,
    weekOf,
    summary,
  });

  // Queue to email_queue → processEmailQueue Cloud Function sends it
  await db()
    .collection("email_queue")
    .add({
      to: [email],
      subject,
      bodyHtml: html,
      channel: "patient_digest",
      orgId,
      patientId: userId,
      status: "pending",
      attempts: 0,
      sentAt: null,
      error: null,
      createdAt: FieldValue.serverTimestamp(),
    });

  logger.info("patientDigest: queued for patient", {
    traceId,
    orgId,
    userId,
    fn: "processPatient",
  });

  return true;
}

// ─── Scheduled Job ─────────────────────────────────────────────────────────────

/**
 * Fires every Sunday at 08:00 UTC.
 * Iterates all active patient enrollments and queues personalized digests.
 */
export const weeklyPatientDigest = onSchedule(
  {
    schedule: "every sunday 08:00",
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

    logger.info("patientDigest: started", {
      traceId,
      weekOf,
      fn: "weeklyPatientDigest",
    });

    try {
      // Query all active roster entries
      const rosterSnap = await db()
        .collection("patient_roster")
        .where("status", "==", "active")
        .limit(1000)
        .get();

      // Group by orgId so we can check notification settings per org once
      const orgPatients = new Map<string, string[]>();
      for (const doc of rosterSnap.docs) {
        const data = doc.data();
        const orgId = data.orgId as string;
        const userId = data.userId as string;
        if (!orgPatients.has(orgId)) orgPatients.set(orgId, []);
        orgPatients.get(orgId)!.push(userId);
      }

      let totalQueued = 0;
      let totalSkipped = 0;

      for (const [orgId, userIds] of orgPatients) {
        // Check if patient_digest channel is enabled for this org
        const notifSnap = await db()
          .collection("organizations")
          .doc(orgId)
          .collection("notification_settings")
          .doc("email")
          .get();

        if (notifSnap.exists) {
          const channels = notifSnap.data()!.channels as
            | Record<string, boolean>
            | undefined;
          if (channels && channels["patient_digest"] === false) {
            totalSkipped += userIds.length;
            continue;
          }
        } else {
          // Default: patient_digest is OFF unless explicitly enabled
          totalSkipped += userIds.length;
          continue;
        }

        // Get org details
        const orgSnap = await db().collection("organizations").doc(orgId).get();
        const orgName = (orgSnap.data()?.name as string) ?? orgId;
        const primaryColor =
          (orgSnap.data()?.settings?.branding?.primaryColor as string) ??
          "#2563EB";

        // Process patients with limited concurrency
        const CONCURRENCY = 10;
        for (let i = 0; i < userIds.length; i += CONCURRENCY) {
          const batch = userIds.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map((userId) =>
              processPatient(
                userId,
                orgId,
                orgName,
                primaryColor,
                weekCutoff,
                weekOf,
                traceId
              )
            )
          );
          for (const r of results) {
            if (r.status === "fulfilled" && r.value) totalQueued++;
            else totalSkipped++;
          }
        }
      }

      logger.info("patientDigest: completed", {
        traceId,
        totalQueued,
        totalSkipped,
        fn: "weeklyPatientDigest",
      });
    } catch (err) {
      logger.error("patientDigest: top-level failure", err as Error, {
        traceId,
        fn: "weeklyPatientDigest",
      });
    }
  }
);
