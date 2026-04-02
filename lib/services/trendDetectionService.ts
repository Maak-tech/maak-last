/**
 * Trend Detection Service — analyses longitudinal health metric sequences
 * to detect clinically relevant trends (worsening, improving, unstable).
 *
 * Used by realtimeHealthService and trendAlertService to identify and
 * surface trends worth alerting the patient or caregiver about.
 */

import { logger } from "@/lib/utils/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrendDirection = "worsening" | "stable" | "improving" | "insufficient_data";

export type TrendSeverity = "none" | "mild" | "moderate" | "significant";

export interface TrendAnalysis {
  metricType: string;
  userId: string;
  direction: TrendDirection;
  severity: TrendSeverity;
  /** Slope of linear regression over the analysis window (units/day) */
  slope: number;
  /** R² of the linear fit (0–1, higher = more consistent trend) */
  rSquared: number;
  /** Number of data points used */
  dataPoints: number;
  /** Analysis window in days */
  windowDays: number;
  /** Latest value in the window */
  latestValue: number;
  /** Baseline mean for this user (null if no baseline) */
  baselineMean: number | null;
  /** Deviation from baseline in standard deviations */
  zScore: number | null;
  analyzedAt: Date;
}

export interface SymptomTrendAnalysis {
  symptomType: string;
  userId: string;
  direction: TrendDirection;
  severity: TrendSeverity;
  /** Average severity score in the recent window (0–10) */
  avgRecentSeverity: number;
  /** Average severity score in the prior window (0–10) */
  avgPriorSeverity: number;
  /** Number of symptom events in recent window */
  recentFrequency: number;
  /** Number of symptom events in prior window */
  priorFrequency: number;
  windowDays: number;
  analyzedAt: Date;
}

export interface TrendAlert {
  id: string;
  userId: string;
  metricType: string;
  alertType: "vital_trend" | "symptom_trend";
  direction: TrendDirection;
  severity: TrendSeverity;
  title: string;
  description: string;
  recommendation: string;
  createdAt: Date;
  /** Whether this trend has been acknowledged by the user or caregiver */
  acknowledged: boolean;
}

// ── Vital trend analysis ───────────────────────────────────────────────────────

/**
 * Analyse a time series of vital readings for a significant trend.
 *
 * @param readings - Array of { value, timestamp } sorted ascending by time
 * @param metricType - e.g. "heartRate", "bloodPressure_systolic"
 * @param userId - Owner of the readings
 * @param baselineMean - Personal baseline mean (null if not yet established)
 * @param baselineStd - Personal baseline std dev (null if not yet established)
 * @param windowDays - How many days of data to analyse (default: 7)
 */
export function analyzeVitalTrend(
  readings: Array<{ value: number; timestamp: Date }>,
  metricType: string,
  userId: string,
  baselineMean: number | null,
  baselineStd: number | null,
  windowDays = 7
): TrendAnalysis {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const inWindow = readings.filter(
    (r) => now - r.timestamp.getTime() <= windowMs
  );

  if (inWindow.length < 3) {
    return {
      metricType, userId,
      direction: "insufficient_data", severity: "none",
      slope: 0, rSquared: 0,
      dataPoints: inWindow.length, windowDays,
      latestValue: inWindow[inWindow.length - 1]?.value ?? 0,
      baselineMean, zScore: null,
      analyzedAt: new Date(),
    };
  }

  // Linear regression (least squares)
  const t0 = inWindow[0].timestamp.getTime();
  const xs = inWindow.map((r) => (r.timestamp.getTime() - t0) / (1000 * 60 * 60 * 24)); // days
  const ys = inWindow.map((r) => r.value);
  const { slope, rSquared } = linearRegression(xs, ys);

  // Classify direction and severity
  const latestValue = ys[ys.length - 1];
  const zScore = baselineMean !== null && baselineStd !== null && baselineStd > 0
    ? (latestValue - baselineMean) / baselineStd
    : null;

  const direction = classifyDirection(slope, rSquared, metricType);
  const severity = classifySeverity(Math.abs(slope), rSquared, zScore);

  return {
    metricType, userId, direction, severity,
    slope, rSquared, dataPoints: inWindow.length, windowDays,
    latestValue, baselineMean, zScore, analyzedAt: new Date(),
  };
}

/**
 * Analyse symptom logs for a worsening or improving trend.
 *
 * @param logs - Array of { severity (0–10), timestamp } symptom logs
 * @param symptomType - e.g. "headache", "fatigue", "chest_pain"
 * @param userId
 * @param windowDays - Split into recent half vs prior half
 */
export function analyzeSymptomTrend(
  logs: Array<{ severity: number; timestamp: Date }>,
  symptomType: string,
  userId: string,
  windowDays = 14
): SymptomTrendAnalysis {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const halfMs = windowMs / 2;

  const recentLogs = logs.filter((l) => now - l.timestamp.getTime() <= halfMs);
  const priorLogs = logs.filter(
    (l) =>
      now - l.timestamp.getTime() > halfMs &&
      now - l.timestamp.getTime() <= windowMs
  );

  const avg = (arr: typeof logs) =>
    arr.length ? arr.reduce((s, l) => s + l.severity, 0) / arr.length : 0;

  const avgRecentSeverity = avg(recentLogs);
  const avgPriorSeverity = avg(priorLogs);
  const delta = avgRecentSeverity - avgPriorSeverity;

  let direction: TrendDirection = "stable";
  let severity: TrendSeverity = "none";

  if (recentLogs.length === 0 && priorLogs.length === 0) {
    direction = "insufficient_data";
  } else if (Math.abs(delta) < 0.5) {
    direction = "stable";
  } else if (delta > 0) {
    direction = "worsening";
    severity = delta > 3 ? "significant" : delta > 1.5 ? "moderate" : "mild";
  } else {
    direction = "improving";
    severity = Math.abs(delta) > 2 ? "moderate" : "mild";
  }

  return {
    symptomType, userId, direction, severity,
    avgRecentSeverity, avgPriorSeverity,
    recentFrequency: recentLogs.length,
    priorFrequency: priorLogs.length,
    windowDays, analyzedAt: new Date(),
  };
}

// ── Trend alert creation ───────────────────────────────────────────────────────

/**
 * Create a TrendAlert from a TrendAnalysis.
 * Returns null if the trend is not concerning enough to alert.
 */
export function createTrendAlert(
  analysis: TrendAnalysis | SymptomTrendAnalysis,
  alertType: "vital_trend" | "symptom_trend"
): TrendAlert | null {
  if (!isTrendConcerning(analysis)) return null;

  const isVital = alertType === "vital_trend";
  const vitalAnalysis = isVital ? (analysis as TrendAnalysis) : null;
  const symptomAnalysis = !isVital ? (analysis as SymptomTrendAnalysis) : null;

  const metricType = isVital
    ? vitalAnalysis!.metricType
    : symptomAnalysis!.symptomType;

  const { direction, severity, userId } = analysis;

  const title = buildAlertTitle(metricType, direction, alertType);
  const description = buildAlertDescription(analysis, alertType);
  const recommendation = buildRecommendation(metricType, direction, severity);

  return {
    id: `trend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    metricType,
    alertType,
    direction,
    severity,
    title,
    description,
    recommendation,
    createdAt: new Date(),
    acknowledged: false,
  };
}

/**
 * Returns true if a trend analysis is concerning enough to surface as an alert.
 */
export function isTrendConcerning(
  analysis: TrendAnalysis | SymptomTrendAnalysis
): boolean {
  if (analysis.direction === "insufficient_data" || analysis.direction === "stable") {
    return false;
  }
  if (analysis.direction === "improving" && analysis.severity === "mild") {
    return false; // improving trends don't need alerts
  }
  return analysis.severity !== "none";
}

// ── Private helpers ────────────────────────────────────────────────────────────

function linearRegression(
  xs: number[],
  ys: number[]
): { slope: number; intercept: number; rSquared: number } {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssXX += (xs[i] - meanX) ** 2;
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;

  // R²
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared };
}

/** Metrics where a rising slope is "worsening" vs "improving" */
const HIGHER_IS_WORSE: Set<string> = new Set([
  "bloodPressure_systolic", "bloodPressure_diastolic",
  "heartRate", "bloodGlucose", "bodyTemperature",
  "symptomSeverity", "weight",
]);

function classifyDirection(
  slope: number,
  rSquared: number,
  metricType: string
): TrendDirection {
  if (rSquared < 0.25 || Math.abs(slope) < 0.05) return "stable";
  const risingIsWorse = HIGHER_IS_WORSE.has(metricType);
  if (slope > 0) return risingIsWorse ? "worsening" : "improving";
  return risingIsWorse ? "improving" : "worsening";
}

function classifySeverity(
  absSlope: number,
  rSquared: number,
  zScore: number | null
): TrendSeverity {
  const confidence = rSquared;
  if (confidence < 0.25) return "none";

  // Use z-score if available for more meaningful severity
  if (zScore !== null) {
    if (Math.abs(zScore) > 3) return "significant";
    if (Math.abs(zScore) > 2) return "moderate";
    if (Math.abs(zScore) > 1.5) return "mild";
    return "none";
  }

  if (absSlope > 5 && confidence > 0.5) return "significant";
  if (absSlope > 2 && confidence > 0.4) return "moderate";
  if (absSlope > 0.5) return "mild";
  return "none";
}

function buildAlertTitle(
  metricType: string,
  direction: TrendDirection,
  alertType: "vital_trend" | "symptom_trend"
): string {
  const metric = metricType.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
  if (direction === "worsening") return `${metric} trending in the wrong direction`;
  if (direction === "improving") return `${metric} is improving`;
  return `${metric} trend detected`;
}

function buildAlertDescription(
  analysis: TrendAnalysis | SymptomTrendAnalysis,
  alertType: "vital_trend" | "symptom_trend"
): string {
  if (alertType === "vital_trend") {
    const a = analysis as TrendAnalysis;
    return (
      `Over the past ${a.windowDays} days, your ${a.metricType} has been ` +
      `${a.direction === "worsening" ? "moving away from" : "moving toward"} your normal range. ` +
      `Latest reading: ${a.latestValue.toFixed(1)}.`
    );
  }
  const a = analysis as SymptomTrendAnalysis;
  return (
    `Your ${a.symptomType} symptoms have been ` +
    `${a.direction === "worsening" ? "getting worse" : "improving"} ` +
    `over the past ${a.windowDays / 2} days.`
  );
}

function buildRecommendation(
  metricType: string,
  direction: TrendDirection,
  severity: TrendSeverity
): string {
  if (direction !== "worsening") return "Keep up the good work. Continue your current habits.";
  if (severity === "significant")
    return "This trend is significant. Consider contacting your healthcare provider soon.";
  if (severity === "moderate")
    return "Monitor this closely. If it continues for 2+ more days, contact your doctor.";
  return "Pay attention to this trend. Review your recent habits that may be affecting it.";
}
