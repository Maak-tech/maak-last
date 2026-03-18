/**
 * Adherence Risk Service (client-side)
 *
 * Reads and interprets the `adherenceRisk` component from a user's Virtual
 * Health Identity. Provides score labels, colour codes, driver explanations,
 * streak helpers, and threshold checks for UI components and Nora's context.
 *
 * The actual adherenceRisk score is computed server-side by `vhiCycle.ts` every
 * 15 minutes and stored in `vhi.data.currentState.riskScores.adherenceRisk`.
 * This service exposes read-only helpers — it does NOT recompute the score.
 *
 * Adherence risk drivers modelled by the server:
 *   - Percentage of medication reminders marked "taken" vs "missed"
 *   - Number of consecutive missed doses (streak)
 *   - Number of active medications (more meds → more complex schedule)
 *   - Time since last taken dose for each active medication
 */

import type { VHI } from "@/lib/services/vhiService";

// ── Thresholds ────────────────────────────────────────────────────────────────

export const ADHERENCE_RISK_THRESHOLDS = {
  CRITICAL: 85, // adherence < 15% over window
  HIGH:     60, // adherence < 40% over window
  MODERATE: 35, // adherence < 65% over window
  LOW:       0,
} as const;

/**
 * Adherence percentage thresholds (inverse of risk).
 * "Excellent" adherence = low risk.
 */
export const ADHERENCE_RATE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD:      75,
  FAIR:      50,
  POOR:       0,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdherenceRiskLevel = "low" | "moderate" | "high" | "critical";

export type AdherenceRateBucket = "excellent" | "good" | "fair" | "poor";

export type AdherenceRiskSummary = {
  score: number;
  level: AdherenceRiskLevel;
  label: string;
  labelAr: string;
  /** The drivers listed in the VHI risk component */
  drivers: string[];
  /** Whether this level warrants a caregiver notification */
  requiresAttention: boolean;
  /** One-sentence guidance for the patient */
  guidance: string;
  guidanceAr: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Classify an adherence risk score (0–100) into a risk level.
 */
export function getAdherenceRiskLevel(score: number): AdherenceRiskLevel {
  if (score >= ADHERENCE_RISK_THRESHOLDS.CRITICAL) return "critical";
  if (score >= ADHERENCE_RISK_THRESHOLDS.HIGH)     return "high";
  if (score >= ADHERENCE_RISK_THRESHOLDS.MODERATE) return "moderate";
  return "low";
}

/**
 * Classify an adherence rate percentage (0–100) into a qualitative bucket.
 * Inverse of risk: a high adherence rate → low risk.
 */
export function getAdherenceRateBucket(ratePct: number): AdherenceRateBucket {
  if (ratePct >= ADHERENCE_RATE_THRESHOLDS.EXCELLENT) return "excellent";
  if (ratePct >= ADHERENCE_RATE_THRESHOLDS.GOOD)      return "good";
  if (ratePct >= ADHERENCE_RATE_THRESHOLDS.FAIR)      return "fair";
  return "poor";
}

/**
 * Infer the approximate adherence rate (0–100) from a risk score.
 * Adherence rate ≈ 100 - riskScore (since adherenceRisk = (1 - adherenceRate) * 100).
 */
export function adherenceRateFromRiskScore(riskScore: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - riskScore)));
}

/**
 * Return a hex colour for a given adherence risk level.
 */
export function getAdherenceRiskColor(
  level: AdherenceRiskLevel,
  colors: { error: string; warning: string; success: string; info?: string }
): string {
  switch (level) {
    case "critical": return colors.error;
    case "high":     return colors.error;
    case "moderate": return colors.warning;
    case "low":      return colors.success;
  }
}

/**
 * Build a human-readable adherence risk summary from a VHI object.
 * Returns `null` if the VHI has not been computed yet.
 */
export function buildAdherenceRiskSummary(
  vhi: VHI | null
): AdherenceRiskSummary | null {
  const adherenceRisk = vhi?.data?.currentState?.riskScores?.adherenceRisk;
  if (!adherenceRisk) return null;

  const score = Math.round(adherenceRisk.score);
  const level = getAdherenceRiskLevel(score);
  const approxRate = adherenceRateFromRiskScore(score);

  const labels: Record<AdherenceRiskLevel, { en: string; ar: string }> = {
    critical: { en: "Critical adherence risk",  ar: "خطر التزام حرج" },
    high:     { en: "High adherence risk",      ar: "خطر التزام مرتفع" },
    moderate: { en: "Moderate adherence risk",  ar: "خطر التزام متوسط" },
    low:      { en: "Good medication adherence", ar: "التزام دوائي جيد" },
  };

  const guidanceMap: Record<AdherenceRiskLevel, { en: string; ar: string }> = {
    critical: {
      en: `Very low adherence (~${approxRate}%) — contact your pharmacist or care team immediately.`,
      ar: `الالتزام منخفض جداً (~${approxRate}٪) — تواصل مع الصيدلاني أو فريق الرعاية فوراً.`,
    },
    high: {
      en: `Medication adherence is low (~${approxRate}%) — use reminders to stay on schedule.`,
      ar: `الالتزام بالأدوية منخفض (~${approxRate}٪) — استخدم التنبيهات للالتزام بالجدول.`,
    },
    moderate: {
      en: `Adherence could be improved (~${approxRate}%) — try to take your medications at the same time each day.`,
      ar: `يمكن تحسين الالتزام (~${approxRate}٪) — حاول تناول أدويتك في نفس الوقت يومياً.`,
    },
    low: {
      en: `Great job — medication adherence is ~${approxRate}%. Keep it up!`,
      ar: `أحسنت — الالتزام بالأدوية ~${approxRate}٪. استمر!`,
    },
  };

  return {
    score,
    level,
    label: labels[level].en,
    labelAr: labels[level].ar,
    drivers: adherenceRisk.drivers ?? [],
    requiresAttention: level === "critical" || level === "high",
    guidance: guidanceMap[level].en,
    guidanceAr: guidanceMap[level].ar,
  };
}

/**
 * Return an adherence percentage string derived from the risk score, e.g. "84%".
 */
export function formatAdherenceRate(riskScore: number): string {
  return `${adherenceRateFromRiskScore(riskScore)}%`;
}

// ── Singleton-style default export ────────────────────────────────────────────

const adherenceRiskService = {
  getRiskLevel:       getAdherenceRiskLevel,
  getRateBucket:      getAdherenceRateBucket,
  rateFromRiskScore:  adherenceRateFromRiskScore,
  getColor:           getAdherenceRiskColor,
  buildSummary:       buildAdherenceRiskSummary,
  formatRate:         formatAdherenceRate,
  RISK_THRESHOLDS:    ADHERENCE_RISK_THRESHOLDS,
  RATE_THRESHOLDS:    ADHERENCE_RATE_THRESHOLDS,
};

export default adherenceRiskService;
