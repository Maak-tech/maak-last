/**
 * VHI Computation Cycle — runs every 15 minutes via Railway cron.
 *
 * Pipeline:
 *   SENSE    → read all health signals for each active user
 *   COMPUTE  → build currentState dimensions, riskScores, careContext, geneticBaseline
 *   SYNTHESIZE → rank elevatingFactors + decliningFactors, build noraContextBlock
 *   WRITE    → upsert vhi table, emit healthTimeline event
 */

import { db } from "../db";
import { runForecastCycle } from "./forecastCycle";
import { dispatchWebhookEvent } from "../lib/webhookDispatcher";
import { broadcastToUser } from "../routes/realtime";
import { logger } from "../lib/logger.js";
import { acquireJobLock, releaseJobLock } from "../lib/jobLock.js";
import {
  pushToUser,
  pushToFamilyAdmins,
  pushToUserAndFamilyAdmins,
} from "../lib/push";
import {
  users,
  vhi,
  vhiSnapshots,
  vitals,
  symptoms,
  moods,
  medications,
  medicationReminders,
  medicalHistory,
  allergies,
  labResults,
  clinicalNotes,
  genetics,
  healthTimeline,
  alerts,
} from "../db/schema";
import { eq, desc, gte, and, isNull, or, lt, sql } from "drizzle-orm";
import crypto from "node:crypto";

const WINDOW_DAYS = 21; // minimum days to establish baseline confidence
const RISK_HIGH = 75;
const RISK_MODERATE = 50;

export async function runVhiCycle() {
  // Distributed lock via job_locks table — works with Neon HTTP driver.
  // (pg_try_advisory_lock is session-scoped and does not work with HTTP connections.)
  const lockToken = await acquireJobLock('vhiCycle', 900)
  if (!lockToken) {
    logger.warn("[vhiCycle] Another instance is running — skipping.");
    return;
  }

  logger.info({ startedAt: new Date().toISOString() }, "[vhiCycle] Starting");

  try {
    // Fetch only users that need a VHI recompute:
    //   1. vhi_dirty = true  — data changed since last compute (set by health writes + realtime worker)
    //   2. Never computed    — new users with no VHI row yet
    //   3. Last compute > 24 hours ago — safety net for users who somehow missed the notify
    const allUsers = await db
      .select({ id: users.id })
      .from(users)
      .leftJoin(vhi, eq(vhi.userId, users.id))
      .where(
        or(
          eq(users.vhiDirty, true),
          isNull(vhi.userId),
          lt(vhi.computedAt, sql`now() - interval '24 hours'`)
        )
      );
    logger.info({ userCount: allUsers.length }, "[vhiCycle] Processing users");

    // Process users in batches to avoid saturating the DB connection pool.
    // Processing all users concurrently would open O(users) simultaneous Neon
    // connections; 50 at a time keeps pool pressure predictable.
    const BATCH_SIZE = 50;
    let successCount = 0;
    let failCount = 0;
    const failedUserIds: string[] = [];
    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(({ id }) => processUser(id))
      );
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === "fulfilled") {
          successCount++;
        } else {
          const userId = batch[j].id;
          const reason: unknown = r.reason;
          logger.error(
            { userId, err: reason },
            "[vhiCycle] User failed (will retry)"
          );
          failedUserIds.push(userId);
        }
      }
    }

    // ── Retry pass ────────────────────────────────────────────────────────────
    // Users that failed in the main pass get one additional attempt.  Transient
    // errors (DB connection hiccups, short-lived Railway network blips) are the
    // most common failure mode, so a single retry resolves the majority of them
    // without requiring a new DB table.
    if (failedUserIds.length > 0) {
      logger.info({ count: failedUserIds.length }, "[vhiCycle] Retrying failed users…");
      for (const retryUserId of failedUserIds) {
        try {
          await processUser(retryUserId);
          successCount++;
        } catch (retryErr) {
          failCount++;
          logger.error(
            { userId: retryUserId, err: retryErr },
            "[vhiCycle] Retry failed for user"
          );
        }
      }
    }

    logger.info(
      { success: successCount, failed: failCount },
      "[vhiCycle] Done"
    );
  } finally {
    // Always release the lock — even if the job body throws.
    await releaseJobLock('vhiCycle', lockToken);
  }
}

export async function processUser(userId: string) {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // ── SENSE phase ──────────────────────────────────────────────────────────────

  const [
    recentVitals,
    recentSymptoms,
    recentMoods,
    activeMeds,
    recentReminders,
    conditions,
    userAllergies,
    recentLabs,
    recentNotes,
    userGenetics,
    recentAlerts,
  ] = await Promise.all([
    db
      .select()
      .from(vitals)
      .where(and(eq(vitals.userId, userId), gte(vitals.recordedAt, windowStart)))
      .orderBy(desc(vitals.recordedAt)),
    db
      .select()
      .from(symptoms)
      .where(
        and(eq(symptoms.userId, userId), gte(symptoms.recordedAt, windowStart))
      )
      .orderBy(desc(symptoms.recordedAt)),
    db
      .select()
      .from(moods)
      .where(and(eq(moods.userId, userId), gte(moods.recordedAt, windowStart)))
      .orderBy(desc(moods.recordedAt)),
    db
      .select()
      .from(medications)
      .where(and(eq(medications.userId, userId), eq(medications.isActive, true))),
    db
      .select()
      .from(medicationReminders)
      .where(
        and(
          eq(medicationReminders.userId, userId),
          gte(medicationReminders.scheduledAt, windowStart)
        )
      ),
    db.select().from(medicalHistory).where(eq(medicalHistory.userId, userId)).limit(100),
    db.select().from(allergies).where(eq(allergies.userId, userId)).limit(100),
    db
      .select()
      .from(labResults)
      .where(eq(labResults.userId, userId))
      .orderBy(desc(labResults.testDate))
      .limit(20),
    db
      .select()
      .from(clinicalNotes)
      .where(eq(clinicalNotes.userId, userId))
      .orderBy(desc(clinicalNotes.noteDate))
      .limit(10),
    db.select().from(genetics).where(eq(genetics.userId, userId)).limit(1),
    db
      .select()
      .from(alerts)
      .where(and(eq(alerts.userId, userId), gte(alerts.createdAt, windowStart)))
      .orderBy(desc(alerts.createdAt)),
  ]);

  const geneticsData = userGenetics[0] ?? null;

  // Skip users with no signal at all — avoids writing a VHI of all-null dimensions
  // that would mislead consumers into thinking the user has been assessed.
  const hasSomeData =
    recentVitals.length > 0 ||
    recentSymptoms.length > 0 ||
    recentMoods.length > 0 ||
    activeMeds.length > 0 ||
    geneticsData != null;

  if (!hasSomeData) {
    logger.info({ userId: userId.slice(0, 8) }, "[vhiCycle] Skipping user — no health data yet");
    return;
  }

  // ── COMPUTE phase ─────────────────────────────────────────────────────────────

  // Medication adherence
  const totalReminders = recentReminders.length;
  const takenReminders = recentReminders.filter(
    (r) => r.status === "taken"
  ).length;
  const adherenceRate =
    totalReminders > 0 ? takenReminders / totalReminders : 1;

  // Consecutive missed doses (streak)
  const sortedReminders = [...recentReminders].sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  );
  let consecutiveMissed = 0;
  for (const r of sortedReminders) {
    if (r.status === "missed") consecutiveMissed++;
    else break;
  }

  // Risk scores (simplified — full ML service enriches these)
  const adherenceRisk = Math.round((1 - adherenceRate) * 100);
  const symptomBurden =
    recentSymptoms.reduce((sum, s) => sum + (s.severity ?? 0), 0) /
    Math.max(recentSymptoms.length, 1);
  const fallCount = recentAlerts.filter((a) => a.type === "fall_detected").length;
  const fallRisk = Math.min(100, fallCount * 25 + (symptomBurden > 7 ? 20 : 0));
  const deteriorationRisk = Math.min(
    100,
    recentSymptoms.filter((s) => (s.severity ?? 0) >= 7).length * 15
  );
  const geneticRiskLoad = computeGeneticRiskLoad(geneticsData);
  const compositeRisk = Math.round(
    fallRisk * 0.3 +
      adherenceRisk * 0.25 +
      deteriorationRisk * 0.25 +
      geneticRiskLoad * 0.2
  );

  // ── SYNTHESIZE phase ──────────────────────────────────────────────────────────

  const elevatingFactors: ElevatingFactor[] = [];
  const decliningFactors: DecliningFactor[] = [];

  if (adherenceRate >= 0.9)
    elevatingFactors.push({
      factor: `Medication adherence ${Math.round(adherenceRate * 100)}% over ${WINDOW_DAYS} days`,
      category: "behavioral",
      impact: "high",
      source: ["medication_reminders"],
      explanation:
        "Consistent medication adherence significantly reduces disease progression risk.",
    });
  else if (adherenceRate < 0.75)
    decliningFactors.push({
      factor: `Medication adherence only ${Math.round(adherenceRate * 100)}% — ${consecutiveMissed} consecutive doses missed`,
      category: "behavioral",
      impact: adherenceRate < 0.5 ? "high" : "medium",
      source: ["medication_reminders"],
      explanation: "Missed doses increase relapse and complication risk.",
      recommendation: "Set medication reminders or ask Nora to help you set a schedule.",
    });

  if (fallRisk > 60)
    decliningFactors.push({
      factor: `Fall risk elevated (${fallRisk}/100) — ${fallCount} fall event(s) detected`,
      category: "behavioral",
      impact: fallRisk > 80 ? "high" : "medium",
      source: ["alerts"],
      explanation: "Multiple fall events signal balance, strength, or medication side effects.",
      recommendation: "Share your fall history with your care team.",
    });

  // Genetic elevating/declining
  if (geneticsData?.prsScores && Array.isArray(geneticsData.prsScores)) {
    const prs = geneticsData.prsScores as Array<{
      condition: string;
      percentile: number;
      level: string;
    }>;
    prs.forEach(({ condition, percentile, level }) => {
      if (level === "low") {
        elevatingFactors.push({
          factor: `Low genetic risk for ${condition} (${percentile}th percentile)`,
          category: "genetic",
          impact: "medium",
          source: ["genetics"],
          explanation: `Your DNA indicates below-average predisposition for ${condition}.`,
        });
      } else if (level === "high" || level === "elevated") {
        decliningFactors.push({
          factor: `${level === "high" ? "High" : "Elevated"} genetic risk for ${condition} (${percentile}th percentile)`,
          category: "genetic",
          impact: level === "high" ? "high" : "medium",
          source: ["genetics"],
          explanation: `Your DNA shows above-average predisposition for ${condition}.`,
          recommendation: `Discuss screening options for ${condition} with your doctor.`,
        });
      }
    });
  }

  // Abnormal labs — check the results JSONB array for flagged values
  const abnormalLabs = recentLabs.filter((l) =>
    l.results?.some((r) => r.flag && r.flag !== "normal")
  );
  if (abnormalLabs.length > 0) {
    decliningFactors.push({
      factor: `${abnormalLabs.length} abnormal lab result(s) on file`,
      category: "clinical",
      impact: abnormalLabs.some((l) => l.results?.some((r) => r.flag === "critical")) ? "high" : "medium",
      source: ["lab_results"],
      explanation: "Abnormal lab values may indicate underlying health changes.",
      recommendation: "Review these results with your doctor.",
    });
  } else if (recentLabs.length > 0) {
    elevatingFactors.push({
      factor: "Recent lab results within normal range",
      category: "clinical",
      impact: "medium",
      source: ["lab_results"],
      explanation: "Normal lab values indicate stable metabolic and organ function.",
    });
  }

  // Sort factors by impact weight
  const impactWeight = { high: 3, medium: 2, low: 1 };
  elevatingFactors.sort(
    (a, b) => impactWeight[b.impact] - impactWeight[a.impact]
  );
  decliningFactors.sort(
    (a, b) => impactWeight[b.impact] - impactWeight[a.impact]
  );

  // Overall score (inverse of composite risk, adjusted by elevating factors)
  const elevatingBonus = Math.min(15, elevatingFactors.length * 3);
  const overallScore = Math.max(
    0,
    Math.min(100, 100 - compositeRisk + elevatingBonus)
  );

  // Nora context block
  const noraContextBlock = buildNoraContext({
    overallScore,
    compositeRisk,
    elevatingFactors: elevatingFactors.slice(0, 3),
    decliningFactors: decliningFactors.slice(0, 3),
    adherenceRate,
    geneticsData,
    activeMeds,
    abnormalLabs,
  });

  // ── WRITE phase ───────────────────────────────────────────────────────────────

  // Read the previous VHI to compute trajectory direction.
  // A change of ≥ 5 points is treated as meaningful — below that threshold
  // normal measurement noise would produce spurious worsening/improving signals.
  const [prevVhiRow] = await db
    .select({ data: vhi.data })
    .from(vhi)
    .where(eq(vhi.userId, userId))
    .limit(1);
  const prevCompositeRisk =
    prevVhiRow?.data?.currentState?.riskScores?.compositeRisk ?? null;
  const trajectory: "worsening" | "stable" | "improving" =
    prevCompositeRisk == null
      ? "stable"
      : compositeRisk > prevCompositeRisk + 5
      ? "worsening"
      : compositeRisk < prevCompositeRisk - 5
      ? "improving"
      : "stable";

  const baselineConfidence = Math.min(1, recentVitals.length / 42); // matures over 42 readings
  const vhiData = {
    baselineConfidence,
    baselineWindowDays: WINDOW_DAYS,
    geneticBaseline: geneticsData ? buildGeneticBaseline(geneticsData) : null,
    currentState: {
      overallScore,
      dimensions: buildDimensions({ recentVitals, recentMoods, recentSymptoms, adherenceRate }),
      riskScores: {
        fallRisk: { score: fallRisk, drivers: ["fall_history", "symptoms"], confidence: 0.7 },
        adherenceRisk: { score: adherenceRisk, drivers: ["medication_reminders"], confidence: 0.95 },
        deteriorationRisk: { score: deteriorationRisk, drivers: ["symptoms"], confidence: 0.6 },
        geneticRiskLoad: { score: geneticRiskLoad, drivers: ["genetics"], confidence: geneticsData ? 0.9 : 0 },
        compositeRisk,
        trajectory,
      },
    },
    careContext: {
      activeConditions: conditions.map((c) => c.condition).filter(Boolean),
      activeAllergies: userAllergies.map((a) => ({
        substance: a.substance,
        severity: a.severity ?? "unknown",
      })),
      activeMedications: activeMeds.map((m) => ({
        name: m.name,
        adherence: adherenceRate,
      })),
      labAbnormalities: abnormalLabs.flatMap((l) => {
        const flaggedResult = l.results?.find((r) => r.flag && r.flag !== "normal");
        // Skip entries where no individual result carries a flag — avoids emitting
        // an entry with an empty value string and a hardcoded "high" flag.
        if (!flaggedResult) return [];
        return [{
          test: l.testName,
          value: String(flaggedResult.value),
          flag: flaggedResult.flag as "high" | "low" | "critical",
        }];
      }),
      recentDoctorNotes: recentNotes.slice(0, 3).map((n) => ({
        date: n.noteDate?.toISOString() ?? "",
        provider: n.providerName ?? "Unknown provider",
        keyPoints: (n.extractedData as { recommendedActions?: string[] } | null)
          ?.recommendedActions ?? [],
      })),
      pendingFollowUps: [],
    },
    elevatingFactors,
    decliningFactors,
    pendingActions: buildPendingActions({ compositeRisk, consecutiveMissed, fallCount }),
    recentActions: [],
    noraContextBlock,
    // Carry forward lastNotificationAt so the cooldown check survives across VHI rewrites.
    // It is updated below if a push is actually dispatched this cycle.
    lastNotificationAt: (prevVhiRow?.data as Record<string, unknown> | null)?.lastNotificationAt ?? null,
  };

  // Wrap VHI upsert + timeline insert in a single transaction so both succeed or fail together.
  // Without this, a crash between the two writes would persist VHI state without a timeline record,
  // causing the history to have silent gaps.
  const computedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(vhi)
      .values({ userId, computedAt, data: vhiData })
      .onConflictDoUpdate({
        target: vhi.userId,
        set: { computedAt, data: vhiData, updatedAt: computedAt },
      });

    await tx.insert(healthTimeline).values({
      id: crypto.randomUUID(),
      userId,
      occurredAt: computedAt,
      source: "vhi_cycle",
      domain: "twin",
      vhiVersion: 1,
      metadata: { compositeRisk, overallScore, elevatingCount: elevatingFactors.length, decliningCount: decliningFactors.length },
    });
  });

  // Archive this computation to vhi_snapshots for historical analysis
  try {
    await db.insert(vhiSnapshots).values({
      id: crypto.randomUUID(),
      userId,
      version: 1,
      computedAt,
      data: vhiData as Record<string, unknown>,
      triggeredBy: 'vhiCycle',
    });
  } catch (snapshotErr) {
    // Never fail the main VHI write because snapshot archiving failed
    logger.warn({ err: snapshotErr }, '[vhiCycle] Failed to write vhi_snapshot');
  }

  // Trigger forecast cycle asynchronously when risk is elevated
  if (compositeRisk >= 60) {
    runForecastCycle(userId).catch((err: unknown) =>
      logger.error({ userId, err }, "[vhiCycle] forecastCycle failed")
    );
  }

  // Broadcast updated VHI to any connected WebSocket clients immediately after write.
  // broadcastToUser is synchronous and in-memory — no await needed.
  broadcastToUser(userId, "vhi.updated", {
    overallScore,
    compositeRisk,
    riskLevel: compositeRisk >= RISK_HIGH ? "high" : compositeRisk >= RISK_MODERATE ? "moderate" : "low",
    trajectory: vhiData.currentState.riskScores.trajectory,
    updatedAt: computedAt.toISOString(),
  });

  // Dispatch webhook events and push alerts concurrently.
  // These are awaited so they complete before processUser resolves — otherwise the
  // cron process can exit before Railway finishes delivering the promises.
  const sideEffects: Promise<unknown>[] = [
    dispatchWebhookEvent("vhi.updated", userId, {
      overallScore,
      compositeRisk,
      riskLevel:
        compositeRisk >= RISK_HIGH ? "high" : compositeRisk >= RISK_MODERATE ? "moderate" : "low",
      trajectory: vhiData.currentState.riskScores.trajectory,
    }).catch((err: unknown) => logger.error({ userId, err }, "[vhiCycle] Webhook dispatch failed")),

    // Push notification cooldown: skip if a notification was sent within the last 4 hours.
    // Without this guard, an elevated-risk user would receive a push every 15 minutes (each cron cycle).
    // 4 hours = 14400000 ms.
    (() => {
      const PUSH_COOLDOWN_MS = 4 * 60 * 60 * 1000;
      const lastAt = (vhiData as Record<string, unknown>).lastNotificationAt;
      const lastMs = typeof lastAt === 'string' ? new Date(lastAt).getTime() : 0;
      if (compositeRisk >= 60 && Date.now() - lastMs < PUSH_COOLDOWN_MS) {
        return Promise.resolve(); // within cooldown window — skip
      }
      return dispatchPushAlerts(userId, compositeRisk, vhiData.decliningFactors[0]?.factor ?? null)
        .then(() => {
          // Update the stored timestamp so the next cycle sees the cooldown
          (vhiData as Record<string, unknown>).lastNotificationAt = new Date().toISOString();
        })
        .catch((err: unknown) => logger.error({ userId, err }, "[vhiCycle] Push alert dispatch failed"));
    })(),
  ];

  // Fire a secondary, higher-priority event when risk crosses the high threshold
  if (compositeRisk >= RISK_HIGH) {
    sideEffects.push(
      dispatchWebhookEvent("vhi.risk_elevated", userId, {
        compositeRisk,
        riskLevel: "high",
        topDecliningFactor: vhiData.decliningFactors[0]?.factor ?? null,
      }).catch((err: unknown) =>
        logger.error({ userId, err }, "[vhiCycle] Risk-elevated webhook failed")
      )
    );
  }

  // Notify SDK consumers when the patient has missed 2+ consecutive doses
  if (consecutiveMissed >= 2) {
    sideEffects.push(
      dispatchWebhookEvent("medication.missed", userId, {
        consecutiveMissed,
        adherenceRate: Math.round(adherenceRate * 100),
      }).catch((err: unknown) =>
        logger.error({ userId, err }, "[vhiCycle] medication.missed webhook failed")
      )
    );
  }

  await Promise.allSettled(sideEffects);

  // Clear the dirty flag now that recompute succeeded.
  // Done after all side effects so a failure mid-pipeline doesn't silently suppress a retry.
  await db.update(users).set({ vhiDirty: false }).where(eq(users.id, userId));
}

/**
 * Dispatch push notifications to patient and/or family admins based on risk level.
 * All three thresholds send non-PHI generic messages per HIPAA guidance.
 */
async function dispatchPushAlerts(
  userId: string,
  compositeRisk: number,
  topDecliningFactor: string | null
): Promise<void> {
  if (compositeRisk < 60) return;

  if (compositeRisk >= 85) {
    // Urgent — patient + admins, high priority
    await pushToUserAndFamilyAdmins(
      userId,
      {
        title: "Health Update",
        body: "Your health identity shows significant changes. Open Nuralix to review.",
        data: { screen: "nora", compositeRisk },
        priority: "high",
      },
      {
        title: "Family Health Alert",
        body: "A family member's health score needs attention. Tap to review their profile.",
        data: { screen: "family", userId, compositeRisk },
        priority: "high",
      }
    );
  } else if (compositeRisk >= 75) {
    // High — patient + admins, normal priority
    await pushToUserAndFamilyAdmins(
      userId,
      {
        title: "Health Update",
        body: "Your health identity shows changes today. Ask Nora about your health.",
        data: { screen: "nora", compositeRisk },
      },
      {
        title: "Family Health Update",
        body: "A family member's health score has changed. Open the family dashboard to review.",
        data: { screen: "family", userId, compositeRisk },
      }
    );
  } else {
    // compositeRisk >= 60 — patient only
    // PHI rule: topDecliningFactor is NOT included in the push body — it may contain
    // medication names, lab values, or other PHI that would appear on a locked screen.
    // Nora provides the full context inside the app after the user taps the notification.
    await pushToUser(userId, {
      title: "Health Update",
      body: "Your health identity shows changes today. Ask Nora.",
      data: { screen: "nora", compositeRisk },
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeGeneticRiskLoad(geneticsData: typeof genetics.$inferSelect | null): number {
  if (!geneticsData?.prsScores || !Array.isArray(geneticsData.prsScores)) return 0;
  const prs = geneticsData.prsScores as Array<{ percentile: number; level: string }>;
  if (!prs.length) return 0;
  const avg = prs.reduce((sum, p) => sum + (Number.isFinite(p.percentile) ? p.percentile : 0), 0) / prs.length;
  const highCount = prs.filter((p) => p.level === "high").length;
  return Math.min(100, Math.round(avg * 0.6 + highCount * 10));
}

function buildGeneticBaseline(g: typeof genetics.$inferSelect) {
  return {
    hasGeneticData: true,
    prsScores: (Array.isArray(g.prsScores) ? g.prsScores : []) as Array<{ condition: string; percentile: number; level: string }>,
    protectiveVariants: [],
    riskVariants: [],
    pharmacogenomics: (Array.isArray(g.pharmacogenomics) ? g.pharmacogenomics : []) as Array<{ drug: string; interaction: string; gene: string }>,
    ancestryGroup: "unknown",
  };
}

function buildPendingActions({
  compositeRisk,
  consecutiveMissed,
  fallCount,
}: {
  compositeRisk: number;
  consecutiveMissed: number;
  fallCount: number;
}) {
  const actions: Array<{
    id: string;
    target: "provider" | "patient" | "caregiver";
    priority: "high" | "low" | "normal" | "urgent";
    actionType: "nudge" | "caregiver_alert" | "provider_alert" | "follow_up_reminder";
    title: string;
    rationale: string;
    dispatched: boolean;
    acknowledged: boolean;
  }> = [];

  if (consecutiveMissed >= 2)
    actions.push({
      id: crypto.randomUUID(),
      target: "patient",
      priority: "high",
      actionType: "nudge",
      title: `You've missed ${consecutiveMissed} doses in a row`,
      rationale: "Medication adherence is critical for managing your conditions.",
      dispatched: false,
      acknowledged: false,
    });

  if (compositeRisk >= RISK_HIGH)
    actions.push({
      id: crypto.randomUUID(),
      target: "caregiver",
      priority: compositeRisk >= 85 ? "urgent" : "high",
      actionType: "caregiver_alert",
      title: "Family member health score declining",
      rationale: `Composite risk score is ${compositeRisk}/100.`,
      dispatched: false,
      acknowledged: false,
    });

  if (fallCount >= 2)
    actions.push({
      id: crypto.randomUUID(),
      target: "provider",
      priority: "high",
      actionType: "provider_alert",
      title: "Multiple fall events detected",
      rationale: `${fallCount} fall events in the last ${21} days.`,
      dispatched: false,
      acknowledged: false,
    });

  return actions;
}

/**
 * Sanitize a user-supplied string before embedding it in a GPT-4o prompt.
 * Strips control characters and newlines (which could inject new prompt lines),
 * and truncates to a maximum length to prevent unbounded context growth.
 */
function sanitizeForPrompt(value: string, maxLength = 120): string {
  return value
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ') // replace control chars with space
    .replace(/\s{2,}/g, ' ')                  // collapse consecutive spaces
    .trim()
    .slice(0, maxLength);
}

function buildNoraContext({
  overallScore,
  compositeRisk,
  elevatingFactors,
  decliningFactors,
  adherenceRate,
  geneticsData,
  activeMeds,
  abnormalLabs,
}: {
  overallScore: number;
  compositeRisk: number;
  elevatingFactors: ElevatingFactor[];
  decliningFactors: DecliningFactor[];
  adherenceRate: number;
  geneticsData: typeof genetics.$inferSelect | null;
  activeMeds: Array<{ name: string }>;
  abnormalLabs: Array<{ testName: string }>;
}): string {
  const riskLabel =
    compositeRisk >= RISK_HIGH ? "HIGH" : compositeRisk >= RISK_MODERATE ? "MODERATE" : "LOW";

  // NOTE: Do NOT include "## Virtual Health Identity" here — every consumer
  // (nora.ts, healthContextService.ts, vhiContextInjector.ts) prepends its own
  // section header. Adding it here would create a duplicate header in every prompt.
  const lines = [
    `Overall Score: ${overallScore}/100 — Composite Risk: ${compositeRisk}/100 (${riskLabel})`,
    `Medication Adherence: ${Math.round(adherenceRate * 100)}%`,
  ];

  if (geneticsData?.prsScores && Array.isArray(geneticsData.prsScores)) {
    lines.push("", "Genetic Baseline:");
    const prs = geneticsData.prsScores as Array<{ condition: string; percentile: number; level: string }>;
    prs.slice(0, 4).forEach(({ condition, percentile, level }) => {
      lines.push(`  ${condition}: ${percentile}th percentile (${level})`);
    });
    if (geneticsData.pharmacogenomics && Array.isArray(geneticsData.pharmacogenomics)) {
      const pg = geneticsData.pharmacogenomics as Array<{ drug: string; interaction: string }>;
      if (pg.length)
        lines.push(
          `  Pharmacogenomics alerts: ${pg.map((p) => `${p.drug} (${p.interaction})`).join(", ")}`
        );
    }
  }

  if (elevatingFactors.length) {
    lines.push("", "Top Elevating Factors:");
    elevatingFactors.forEach((f, i) =>
      lines.push(`  ${i + 1}. [${f.impact.toUpperCase()}] ${f.factor}`)
    );
  }

  if (decliningFactors.length) {
    lines.push("", "Top Declining Factors:");
    decliningFactors.forEach((f, i) =>
      lines.push(`  ${i + 1}. [${f.impact.toUpperCase()}] ${f.factor}`)
    );
  }

  if (activeMeds.length)
    // sanitizeForPrompt prevents a crafted medication name from injecting new prompt lines.
    lines.push("", `Active Medications: ${activeMeds.map((m) => sanitizeForPrompt(m.name)).join(", ")}`);

  if (abnormalLabs.length)
    lines.push("", `Abnormal Labs: ${abnormalLabs.map((l) => sanitizeForPrompt(l.testName)).join(", ")}`);

  // NOTE: Do NOT append Nora persona instructions here — each consumer (nora.ts,
  // healthContextService.ts) already has its own Nora system prompt preamble.
  // Repeating them inside noraContextBlock places them mid-prompt, not at the end.

  return lines.join("\n");
}

// ── Dimension computation ─────────────────────────────────────────────────────

type VitalRow = typeof vitals.$inferSelect;
type MoodRow = typeof moods.$inferSelect;
type SymptomRow = typeof symptoms.$inferSelect;

// Must match VirtualHealthIdentityData.currentState.dimensions value shape exactly
type DBDimension = {
  currentValue: number | null;
  baselineValue: number | null;
  zScore: number | null;
  direction: "above" | "below" | "stable" | "unknown";
  deviation: "none" | "mild" | "moderate" | "significant";
  trend7d: "worsening" | "stable" | "improving" | "insufficient";
  lastDataAt: string | null;
  isStale: boolean;
};

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Extract numeric values (most-recent-first) for a given vital type. */
function vitalValues(rows: VitalRow[], ...types: string[]): { value: number; recordedAt: Date }[] {
  return rows
    .filter((r) => types.includes(r.type) && r.value !== null && r.value !== undefined)
    .map((r) => ({ value: parseFloat(String(r.value)), recordedAt: r.recordedAt }))
    .filter((v) => !isNaN(v.value));
}

/** Convert an array of {value, recordedAt} readings into a DBDimension. */
/**
 * @param higherIsBetter  true for metrics where trending up = health improving
 *                        (HRV, sleep, steps, mood, SpO2, adherence).
 *                        false for metrics where trending down = health improving
 *                        (heart rate, blood pressure, symptom burden, respiratory rate).
 */
function toDimension(
  readings: { value: number; recordedAt: Date }[],
  higherIsBetter = true,
): DBDimension {
  if (readings.length === 0) {
    return {
      currentValue: null, baselineValue: null, zScore: null,
      direction: "unknown", deviation: "none",
      trend7d: "insufficient", lastDataAt: null, isStale: true,
    };
  }

  const values = readings.map((r) => r.value);
  const baselineValue = values.reduce((s, v) => s + v, 0) / values.length;
  const recentSlice = values.slice(0, Math.min(7, values.length));
  const currentValue = recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length;

  // Use Math.max to handle baselineValue = 0 (e.g. a vital that hasn't been recorded yet).
  // Without this guard, spread = 0 * 0.1 || 1 = 1, which is correct by accident via the
  // || fallback, but explicit Math.max is clearer and handles negative baselines too.
  const spread = Math.max(Math.abs(baselineValue * 0.1), 1);
  const zScore = Math.max(-3, Math.min(3, (currentValue - baselineValue) / spread));

  const absZ = Math.abs(zScore);
  const deviation: DBDimension["deviation"] =
    absZ < 0.5 ? "none" : absZ < 1 ? "mild" : absZ < 2 ? "moderate" : "significant";

  const direction: DBDimension["direction"] =
    zScore > 0.5 ? "above" : zScore < -0.5 ? "below" : "stable";

  // Trend: compare recent half vs older half of the window.
  // Data is ordered desc (most-recent first), so slice(0, mid) = most recent half.
  // Interpretation flips for metrics where lower = healthier.
  let trend7d: DBDimension["trend7d"] = "insufficient";
  if (values.length >= 5) {
    const mid = Math.floor(values.length / 2);
    const recentAvg = values.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
    const olderAvg = values.slice(mid).reduce((s, v) => s + v, 0) / (values.length - mid);
    const delta = (recentAvg - olderAvg) / (olderAvg || 1);
    // For lower-is-better metrics, invert the polarity: values going down = improving
    const improving = higherIsBetter ? delta > 0.05 : delta < -0.05;
    const worsening = higherIsBetter ? delta < -0.05 : delta > 0.05;
    trend7d = improving ? "improving" : worsening ? "worsening" : "stable";
  }

  const lastDataAt = readings[0].recordedAt.toISOString();
  const isStale = Date.now() - readings[0].recordedAt.getTime() > STALE_THRESHOLD_MS;

  return {
    currentValue: Math.round(currentValue * 10) / 10,
    baselineValue: Math.round(baselineValue * 10) / 10,
    zScore: Math.round(zScore * 100) / 100,
    direction, deviation, trend7d, lastDataAt, isStale,
  };
}

/**
 * Build the 13-dimension grid from available sensor data.
 * Always returns a Record<string, DBDimension> — empty {} when no vitals.
 */
function buildDimensions({
  recentVitals,
  recentMoods,
  recentSymptoms,
  adherenceRate,
}: {
  recentVitals: VitalRow[];
  recentMoods: MoodRow[];
  recentSymptoms: SymptomRow[];
  adherenceRate: number;
}): Record<string, DBDimension> {
  if (recentVitals.length === 0 && recentMoods.length === 0) return {};

  // HRV: prefer dedicated hrv type; fall back to metadata on heart_rate readings
  const hrvDirect = vitalValues(recentVitals, "hrv");
  const hrvFromMeta = recentVitals
    .filter((r) => r.type === "heart_rate" && r.metadata?.heartRateVariability != null)
    .map((r) => ({ value: r.metadata!.heartRateVariability as number, recordedAt: r.recordedAt }));
  const hrvReadings = hrvDirect.length > 0 ? hrvDirect : hrvFromMeta;

  // Mood: use intensity (1-5) from moods table
  const moodReadings = recentMoods
    .filter((m) => m.intensity != null && m.intensity > 0)
    .map((m) => ({ value: m.intensity as number, recordedAt: m.recordedAt }));

  // Symptom burden: severity (1-10) from symptoms table
  const symptomReadings = recentSymptoms
    .filter((s) => s.severity != null && s.severity > 0)
    .map((s) => ({ value: s.severity as number, recordedAt: s.recordedAt }));

  // Medication adherence: synthesise as a scalar dimension
  const adherenceValue = Math.round(adherenceRate * 100 * 10) / 10;
  const adherenceDimension: DBDimension = {
    currentValue: adherenceValue,
    baselineValue: null,
    zScore: null,
    direction: adherenceValue >= 90 ? "above" : adherenceValue >= 75 ? "stable" : "below",
    deviation: adherenceValue < 75 ? "significant" : adherenceValue < 90 ? "mild" : "none",
    trend7d: "insufficient",
    lastDataAt: null,
    isStale: false,
  };

  return {
    heartRate:        toDimension(vitalValues(recentVitals, "heart_rate"),                      false), // lower is healthier
    hrv:              toDimension(hrvReadings),                                                         // higher is healthier
    sleepHours:       toDimension(vitalValues(recentVitals, "sleep", "sleep_duration", "sleep_hours")), // higher is healthier
    steps:            toDimension(vitalValues(recentVitals, "steps")),                                  // higher is healthier
    mood:             toDimension(moodReadings),                                                        // higher is healthier (1–5)
    symptomBurden:    toDimension(symptomReadings,                                               false), // lower is healthier
    medicationAdherence: adherenceDimension,
    bloodPressure:    toDimension(vitalValues(recentVitals, "blood_pressure"),                   false), // lower is healthier
    bloodGlucose:     toDimension(vitalValues(recentVitals, "blood_glucose", "glucose"),         false), // lower is healthier
    oxygenSaturation: toDimension(vitalValues(recentVitals, "oxygen_saturation", "spo2")),              // higher is healthier
    weight:           toDimension(vitalValues(recentVitals, "weight")),                                 // neutral — treat as higher=better (trend for adherence context)
    respiratoryRate:  toDimension(vitalValues(recentVitals, "respiratory_rate"),                 false), // lower is healthier
    bodyTemperature:  toDimension(vitalValues(recentVitals, "temperature", "body_temperature"),  false), // lower is healthier (fever reducing = improving)
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ElevatingFactor = {
  factor: string;
  category: "genetic" | "behavioral" | "clinical" | "environmental";
  impact: "high" | "medium" | "low";
  source: string[];
  explanation: string;
};

type DecliningFactor = {
  factor: string;
  category: "genetic" | "behavioral" | "clinical" | "environmental";
  impact: "high" | "medium" | "low";
  source: string[];
  explanation: string;
  recommendation: string;
};

// ── Entry point ───────────────────────────────────────────────────────────────
/**
 * Public alias used by the realtime VHI worker (vhiRealtimeWorker.ts).
 * The bulk cron continues to call processUser directly.
 */
export const computeVHIForUser = processUser;

// Guard with import.meta.main so this file can be safely imported as a module
// (e.g. from vhiRoutes to trigger a single-user recompute) without auto-running
// the full cycle and calling process.exit().

if (import.meta.main) {
  runVhiCycle()
    .then(async () => {
      const { recordHeartbeat } = await import("../lib/heartbeat");
      await recordHeartbeat("vhi-cycle", 15 * 60);
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, "[vhiCycle] Fatal error");
      try {
        const { recordHeartbeatError } = await import("../lib/heartbeat");
        await recordHeartbeatError("vhi-cycle", 15 * 60, err instanceof Error ? err.message : String(err));
      } catch { /* ignore */ }
      process.exit(1);
    });
}
