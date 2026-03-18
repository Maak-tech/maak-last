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
import {
  users,
  vhi,
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
import { eq, desc, gte, and, isNull } from "drizzle-orm";
import crypto from "node:crypto";

const WINDOW_DAYS = 21; // minimum days to establish baseline confidence
const RISK_HIGH = 75;
const RISK_MODERATE = 50;

async function runVhiCycle() {
  console.log(`[vhiCycle] Starting at ${new Date().toISOString()}`);

  // Fetch all users with enough data to compute VHI
  const allUsers = await db.select({ id: users.id }).from(users);
  console.log(`[vhiCycle] Processing ${allUsers.length} users`);

  const results = await Promise.allSettled(
    allUsers.map(({ id }) => processUser(id))
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[vhiCycle] ${failed.length} users failed:`);
    failed.forEach((r) => {
      if (r.status === "rejected") console.error("  ", r.reason);
    });
  }

  console.log(
    `[vhiCycle] Done. Success: ${results.length - failed.length}, Failed: ${failed.length}`
  );
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
    db.select().from(medicalHistory).where(eq(medicalHistory.userId, userId)),
    db.select().from(allergies).where(eq(allergies.userId, userId)),
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
  if (geneticsData?.prsScores) {
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
        trajectory: "stable" as const,
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
      labAbnormalities: abnormalLabs.map((l) => {
        const flaggedResult = l.results?.find((r) => r.flag && r.flag !== "normal");
        return {
          test: l.testName,
          value: String(flaggedResult?.value ?? ""),
          flag: (flaggedResult?.flag as "high" | "low" | "critical") ?? "high",
        };
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
  };

  await db
    .insert(vhi)
    .values({ userId, computedAt: new Date(), data: vhiData })
    .onConflictDoUpdate({
      target: vhi.userId,
      set: { computedAt: new Date(), data: vhiData, updatedAt: new Date() },
    });

  // Write timeline event
  await db.insert(healthTimeline).values({
    id: crypto.randomUUID(),
    userId,
    occurredAt: new Date(),
    source: "vhi_cycle",
    domain: "twin",
    vhiVersion: 1,
    metadata: { compositeRisk, overallScore, elevatingCount: elevatingFactors.length, decliningCount: decliningFactors.length },
  });

  // Trigger forecast cycle asynchronously when risk is elevated
  if (compositeRisk >= 60) {
    runForecastCycle(userId).catch((err) =>
      console.error(`[vhiCycle] forecastCycle failed for ${userId}:`, err)
    );
  }

  // Dispatch webhook events to SDK consumers (non-blocking, org-roster-filtered)
  dispatchWebhookEvent("vhi.updated", userId, {
    overallScore,
    compositeRisk,
    riskLevel:
      compositeRisk >= RISK_HIGH ? "high" : compositeRisk >= RISK_MODERATE ? "moderate" : "low",
    trajectory: vhiData.currentState.riskScores.trajectory,
  }).catch((err) => console.error(`[vhiCycle] Webhook dispatch failed for ${userId}:`, err));

  // Fire a secondary, higher-priority event when risk crosses the high threshold
  if (compositeRisk >= RISK_HIGH) {
    dispatchWebhookEvent("vhi.risk_elevated", userId, {
      compositeRisk,
      riskLevel: "high",
      topDecliningFactor: vhiData.decliningFactors[0]?.factor ?? null,
    }).catch((err) =>
      console.error(`[vhiCycle] Risk-elevated webhook failed for ${userId}:`, err)
    );
  }

  // Notify SDK consumers when the patient has missed 2+ consecutive doses
  if (consecutiveMissed >= 2) {
    dispatchWebhookEvent("medication.missed", userId, {
      consecutiveMissed,
      adherenceRate: Math.round(adherenceRate * 100),
    }).catch((err) =>
      console.error(`[vhiCycle] medication.missed webhook failed for ${userId}:`, err)
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeGeneticRiskLoad(geneticsData: typeof genetics.$inferSelect | null): number {
  if (!geneticsData?.prsScores) return 0;
  const prs = geneticsData.prsScores as Array<{ percentile: number; level: string }>;
  if (!prs.length) return 0;
  const avg = prs.reduce((sum, p) => sum + p.percentile, 0) / prs.length;
  const highCount = prs.filter((p) => p.level === "high").length;
  return Math.min(100, Math.round(avg * 0.6 + highCount * 10));
}

function buildGeneticBaseline(g: typeof genetics.$inferSelect) {
  return {
    hasGeneticData: true,
    prsScores: (g.prsScores as Array<{ condition: string; percentile: number; level: string }> | null) ?? [],
    protectiveVariants: [],
    riskVariants: [],
    pharmacogenomics: (g.pharmacogenomics as Array<{ drug: string; interaction: string; gene: string }> | null) ?? [],
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

  if (geneticsData?.prsScores) {
    lines.push("", "Genetic Baseline:");
    const prs = geneticsData.prsScores as Array<{ condition: string; percentile: number; level: string }>;
    prs.slice(0, 4).forEach(({ condition, percentile, level }) => {
      lines.push(`  ${condition}: ${percentile}th percentile (${level})`);
    });
    if (geneticsData.pharmacogenomics) {
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
    lines.push("", `Active Medications: ${activeMeds.map((m) => m.name).join(", ")}`);

  if (abnormalLabs.length)
    lines.push("", `Abnormal Labs: ${abnormalLabs.map((l) => l.testName).join(", ")}`);

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
    .filter((r) => types.includes(r.type) && r.value !== null)
    .map((r) => ({ value: parseFloat(r.value as string), recordedAt: r.recordedAt }))
    .filter((v) => !isNaN(v.value));
}

/** Convert an array of {value, recordedAt} readings into a DBDimension. */
function toDimension(readings: { value: number; recordedAt: Date }[]): DBDimension {
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

  const spread = baselineValue * 0.1 || 1;
  const zScore = Math.max(-3, Math.min(3, (currentValue - baselineValue) / spread));

  const absZ = Math.abs(zScore);
  const deviation: DBDimension["deviation"] =
    absZ < 0.5 ? "none" : absZ < 1 ? "mild" : absZ < 2 ? "moderate" : "significant";

  const direction: DBDimension["direction"] =
    zScore > 0.5 ? "above" : zScore < -0.5 ? "below" : "stable";

  // Trend: compare recent 7 vs older readings; "insufficient" if < 5 total
  let trend7d: DBDimension["trend7d"] = "insufficient";
  if (values.length >= 5) {
    const mid = Math.floor(values.length / 2);
    const recentAvg = values.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
    const olderAvg = values.slice(mid).reduce((s, v) => s + v, 0) / (values.length - mid);
    const delta = (recentAvg - olderAvg) / (olderAvg || 1);
    trend7d = delta > 0.05 ? "improving" : delta < -0.05 ? "worsening" : "stable";
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
    heartRate: toDimension(vitalValues(recentVitals, "heart_rate")),
    hrv: toDimension(hrvReadings),
    sleepHours: toDimension(vitalValues(recentVitals, "sleep", "sleep_duration", "sleep_hours")),
    steps: toDimension(vitalValues(recentVitals, "steps")),
    mood: toDimension(moodReadings),
    symptomBurden: toDimension(symptomReadings),
    medicationAdherence: adherenceDimension,
    bloodPressure: toDimension(vitalValues(recentVitals, "blood_pressure")),
    bloodGlucose: toDimension(vitalValues(recentVitals, "blood_glucose", "glucose")),
    oxygenSaturation: toDimension(vitalValues(recentVitals, "oxygen_saturation", "spo2")),
    weight: toDimension(vitalValues(recentVitals, "weight")),
    respiratoryRate: toDimension(vitalValues(recentVitals, "respiratory_rate")),
    bodyTemperature: toDimension(vitalValues(recentVitals, "temperature", "body_temperature")),
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
// Guard with import.meta.main so this file can be safely imported as a module
// (e.g. from vhiRoutes to trigger a single-user recompute) without auto-running
// the full cycle and calling process.exit().

if (import.meta.main) {
  runVhiCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[vhiCycle] Fatal error:", err);
      process.exit(1);
    });
}
