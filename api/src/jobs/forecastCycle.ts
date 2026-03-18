/**
 * Forecast Cycle — runs on elevated-risk users (compositeRisk ≥ 60).
 *
 * Triggered by vhiCycle when compositeRisk crosses the threshold, OR run
 * independently via Railway cron every 6 hours as a full sweep.
 *
 * Pipeline:
 *   SELECT  → users whose latest VHI has compositeRisk ≥ 60
 *   TREND   → compute 7-day linear trend for key vital dimensions
 *   FORECAST → project 7/14/30-day trajectories (rule-based + optional ML service)
 *   WRITE   → update vhi.data trajectory + push notifications for worsening
 */

import { db } from "../db";
import {
  vhi,
  vitals,
  medicationReminders,
  pushTokens,
  healthTimeline,
  type VirtualHealthIdentityData,
} from "../db/schema";
import { eq, gte, desc, and } from "drizzle-orm";
import crypto from "node:crypto";

const COMPOSITE_RISK_THRESHOLD = 60;
const WORSENING_NOTIFICATION_THRESHOLD = 70;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskTrajectory = "worsening" | "stable" | "improving";

type VitalSeries = {
  dimension: string;
  timestamps: number[]; // unix ms
  values: number[];
};

type DimensionForecast = {
  dimension: string;
  trend7d: RiskTrajectory;
  slope: number; // per-day change (z-score units)
  projectedValue7d: number | null;
  projectedValue14d: number | null;
  projectedValue30d: number | null;
  confidence: number; // 0–1
};

type ForecastResult = {
  trajectory: RiskTrajectory;
  compositeRiskProjected7d: number;
  compositeRiskProjected14d: number;
  compositeRiskProjected30d: number;
  dimensionForecasts: DimensionForecast[];
  method: "ml_service" | "linear_regression";
};

// ── Entry point ───────────────────────────────────────────────────────────────

async function runForecastCycle(targetUserId?: string) {
  console.log(`[forecastCycle] Starting at ${new Date().toISOString()}`);

  // Select users who need forecasting.
  // When a specific userId is provided (triggered from vhiCycle) filter at the DB level
  // to avoid a full table scan that loads every user's VHI JSONB into memory.
  const vhiQuery = db
    .select({ userId: vhi.userId, data: vhi.data, computedAt: vhi.computedAt })
    .from(vhi);

  const allVhi = targetUserId
    ? await vhiQuery.where(eq(vhi.userId, targetUserId))
    : await vhiQuery;

  const eligibleUsers = allVhi.filter((row) => {
    const compositeRisk = row.data?.currentState?.riskScores?.compositeRisk ?? 0;
    return compositeRisk >= COMPOSITE_RISK_THRESHOLD;
  });

  console.log(
    `[forecastCycle] ${eligibleUsers.length} users above risk threshold (${COMPOSITE_RISK_THRESHOLD})`
  );

  const results = await Promise.allSettled(
    eligibleUsers.map((row) => processUserForecast(row.userId, row.data))
  );

  const failed = results.filter((r) => r.status === "rejected");
  console.log(
    `[forecastCycle] Done. Success: ${results.length - failed.length}, Failed: ${failed.length}`
  );
  failed.forEach((r) => {
    if (r.status === "rejected") console.error("[forecastCycle]", r.reason);
  });
}

// ── Per-user forecast ─────────────────────────────────────────────────────────

async function processUserForecast(
  userId: string,
  currentVhiData: VirtualHealthIdentityData | null | undefined
) {
  const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14-day window

  // Fetch recent vitals for key dimensions
  const recentVitals = await db
    .select({
      type: vitals.type,
      value: vitals.value,
      recordedAt: vitals.recordedAt,
    })
    .from(vitals)
    .where(and(eq(vitals.userId, userId), gte(vitals.recordedAt, windowStart)))
    .orderBy(desc(vitals.recordedAt));

  // Fetch medication adherence trend
  const recentReminders = await db
    .select({ status: medicationReminders.status, scheduledAt: medicationReminders.scheduledAt })
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        gte(medicationReminders.scheduledAt, windowStart)
      )
    );

  // Build vital series per dimension
  const vitalSeriesMap = buildVitalSeries(recentVitals);
  const adherenceSeries = buildAdherenceSeries(recentReminders);
  if (adherenceSeries) vitalSeriesMap.set("medication_adherence", adherenceSeries);

  // Compute linear trend for each dimension
  const dimensionForecasts: DimensionForecast[] = [];
  for (const [dimension, series] of vitalSeriesMap) {
    if (series.values.length < 3) continue; // need at least 3 points
    const forecast = forecastDimension(dimension, series);
    dimensionForecasts.push(forecast);
  }

  // Try ML service for full composite forecast
  let result: ForecastResult | null = null;
  if (dimensionForecasts.length >= 2) {
    result = await tryMlServiceForecast(userId, dimensionForecasts);
  }

  // Fall back to rule-based if ML service unavailable
  if (!result) {
    result = buildRuleBasedForecast(
      dimensionForecasts,
      (currentVhiData?.currentState?.riskScores?.compositeRisk as number | undefined) ?? 60
    );
  }

  // Update VHI with trajectory
  const updatedData = {
    ...(currentVhiData ?? {}),
    currentState: {
      ...((currentVhiData as Record<string, unknown>)?.currentState ?? {}),
      riskScores: {
        ...((currentVhiData as Record<string, unknown>)?.currentState as Record<string, unknown>)?.riskScores ?? {},
        trajectory: result.trajectory,
        forecast: {
          compositeRisk7d: result.compositeRiskProjected7d,
          compositeRisk14d: result.compositeRiskProjected14d,
          compositeRisk30d: result.compositeRiskProjected30d,
          dimensionForecasts: result.dimensionForecasts,
          method: result.method,
          computedAt: new Date().toISOString(),
        },
      },
    },
  };

  await db
    .update(vhi)
    .set({ data: updatedData as unknown as typeof vhi.$inferSelect.data, updatedAt: new Date() })
    .where(eq(vhi.userId, userId));

  // Write timeline event
  await db.insert(healthTimeline).values({
    id: crypto.randomUUID(),
    userId,
    occurredAt: new Date(),
    source: "forecast_cycle",
    domain: "twin",
    metadata: {
      trajectory: result.trajectory,
      compositeRisk7d: result.compositeRiskProjected7d,
      method: result.method,
    },
  });

  // Push notification for worsening trajectory
  const currentRisk = (currentVhiData?.currentState?.riskScores?.compositeRisk as number | undefined) ?? 0;
  if (
    result.trajectory === "worsening" &&
    result.compositeRiskProjected7d >= WORSENING_NOTIFICATION_THRESHOLD
  ) {
    await sendWorseningNotification(userId, currentRisk, result.compositeRiskProjected7d);
  }

  console.log(
    `[forecastCycle] ${userId}: ${result.trajectory} (7d risk: ${result.compositeRiskProjected7d}, method: ${result.method})`
  );
}

// ── Vital series builder ───────────────────────────────────────────────────────

const VITAL_DIMENSION_MAP: Record<string, string> = {
  heart_rate: "heartRate",
  hrv: "hrv",
  sleep_hours: "sleepHours",
  steps: "steps",
  blood_pressure_systolic: "bloodPressureSystolic",
  blood_pressure_diastolic: "bloodPressureDiastolic",
  blood_glucose: "bloodGlucose",
  weight: "weight",
  oxygen_saturation: "oxygenSaturation",
  respiratory_rate: "respiratoryRate",
  body_temperature: "bodyTemperature",
};

function buildVitalSeries(
  rows: Array<{ type: string; value: string | null; recordedAt: Date }>
): Map<string, VitalSeries> {
  const byDimension = new Map<string, Array<{ ts: number; val: number }>>();

  for (const row of rows) {
    const dimension = VITAL_DIMENSION_MAP[row.type] ?? row.type;
    const val = parseFloat(row.value ?? "");
    if (Number.isNaN(val)) continue;

    if (!byDimension.has(dimension)) byDimension.set(dimension, []);
    byDimension.get(dimension)!.push({ ts: row.recordedAt.getTime(), val });
  }

  const series = new Map<string, VitalSeries>();
  for (const [dimension, points] of byDimension) {
    points.sort((a, b) => a.ts - b.ts);
    series.set(dimension, {
      dimension,
      timestamps: points.map((p) => p.ts),
      values: points.map((p) => p.val),
    });
  }
  return series;
}

function buildAdherenceSeries(
  reminders: Array<{ status: string | null; scheduledAt: Date }>
): VitalSeries | null {
  if (!reminders.length) return null;

  // Group by day → compute daily adherence rate
  const byDay = new Map<string, { taken: number; total: number }>();
  for (const r of reminders) {
    const day = r.scheduledAt.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { taken: 0, total: 0 });
    const d = byDay.get(day)!;
    d.total++;
    if (r.status === "taken") d.taken++;
  }

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    dimension: "medication_adherence",
    timestamps: days.map(([d]) => new Date(d).getTime()),
    values: days.map(([, v]) => v.total > 0 ? v.taken / v.total : 0),
  };
}

// ── Linear regression forecast ─────────────────────────────────────────────────

/**
 * Simple OLS linear regression.
 * Returns slope (units per ms) and intercept.
 */
function linearRegression(
  xs: number[],
  ys: number[]
): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };

  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssXX += (xs[i] - meanX) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

function forecastDimension(dimension: string, series: VitalSeries): DimensionForecast {
  const { timestamps, values } = series;
  const { slope, intercept, r2 } = linearRegression(timestamps, values);

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const slopePerDay = slope * msPerDay;

  const project = (daysAhead: number) =>
    values.length > 0 ? slope * (now + daysAhead * msPerDay) + intercept : null;

  // Classify trend direction
  // For "bad" dimensions (higher = worse), worsening means rising slope
  // For "good" dimensions (higher = better), worsening means falling slope
  const BAD_RISING = new Set(["heartRate", "bloodPressureSystolic", "bloodPressureDiastolic",
    "bloodGlucose", "bodyTemperature", "respiratoryRate"]);
  const GOOD_RISING = new Set(["sleepHours", "steps", "oxygenSaturation", "medication_adherence",
    "hrv"]);

  const STABLE_THRESHOLD = 0.05; // less than 5% of mean per day = stable
  const meanVal = values.reduce((s, v) => s + v, 0) / values.length;
  const relativeChange = meanVal !== 0 ? Math.abs(slopePerDay / meanVal) : 0;

  let trend7d: RiskTrajectory = "stable";
  if (relativeChange > STABLE_THRESHOLD) {
    if (BAD_RISING.has(dimension)) {
      trend7d = slope > 0 ? "worsening" : "improving";
    } else if (GOOD_RISING.has(dimension)) {
      trend7d = slope > 0 ? "improving" : "worsening";
    }
  }

  return {
    dimension,
    trend7d,
    slope: slopePerDay,
    projectedValue7d: project(7),
    projectedValue14d: project(14),
    projectedValue30d: project(30),
    confidence: Math.max(0, Math.min(1, r2)),
  };
}

// ── ML service forecast ────────────────────────────────────────────────────────

async function tryMlServiceForecast(
  userId: string,
  dimensionForecasts: DimensionForecast[]
): Promise<ForecastResult | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/api/forecast/composite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, dimensionForecasts }),
      signal: AbortSignal.timeout(10_000), // 10-second timeout
    });

    if (!res.ok) return null;
    return (await res.json()) as ForecastResult;
  } catch {
    // ML service unavailable or timed out — use rule-based fallback silently
    return null;
  }
}

// ── Rule-based composite forecast ─────────────────────────────────────────────

function buildRuleBasedForecast(
  dimensionForecasts: DimensionForecast[],
  currentCompositeRisk: number
): ForecastResult {
  const worseningCount = dimensionForecasts.filter((d) => d.trend7d === "worsening").length;
  const improvingCount = dimensionForecasts.filter((d) => d.trend7d === "improving").length;
  const total = dimensionForecasts.length;

  // Composite trajectory: majority rules with confidence weighting
  let trajectory: RiskTrajectory = "stable";
  if (total > 0) {
    const worseRatio = worseningCount / total;
    const improveRatio = improvingCount / total;
    if (worseRatio > 0.4) trajectory = "worsening";
    else if (improveRatio > 0.5) trajectory = "improving";
  }

  // Project composite risk linearly
  const delta = trajectory === "worsening" ? 8 : trajectory === "improving" ? -6 : 0;
  const project7d = Math.max(0, Math.min(100, currentCompositeRisk + delta));
  const project14d = Math.max(0, Math.min(100, currentCompositeRisk + delta * 2));
  const project30d = Math.max(0, Math.min(100, currentCompositeRisk + delta * 3.5));

  return {
    trajectory,
    compositeRiskProjected7d: Math.round(project7d),
    compositeRiskProjected14d: Math.round(project14d),
    compositeRiskProjected30d: Math.round(project30d),
    dimensionForecasts,
    method: "linear_regression",
  };
}

// ── Push notification for worsening trajectory ────────────────────────────────

async function sendWorseningNotification(
  userId: string,
  currentRisk: number,
  projectedRisk7d: number
) {
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));

  if (!tokens.length) return;

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: "default" as const,
    title: "Your health trend needs attention",
    body: `Your health risk may rise from ${currentRisk} to ~${projectedRisk7d} over the next 7 days. Ask Nora what you can do.`,
    data: { screen: "vhi", type: "forecast_alert" },
  }));

  const expoToken = process.env.EXPO_ACCESS_TOKEN;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10_000), // 10-second delivery timeout
  }).catch((err) => console.error("[forecastCycle] Push failed:", err));
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Guard with import.meta.main so this file can be safely imported as a module
// (e.g. from vhiCycle to trigger per-user forecasts on elevated risk) without
// auto-running the full sweep and calling process.exit().
//
// Standalone usage:
//   bun run src/jobs/forecastCycle.ts              → sweeps all elevated users
//   bun run src/jobs/forecastCycle.ts <userId>     → one user only

// Export first so the import in vhiCycle resolves cleanly
export { runForecastCycle };

if (import.meta.main) {
  const targetUser = process.argv[2];
  runForecastCycle(targetUser)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[forecastCycle] Fatal error:", err);
      process.exit(1);
    });
}
