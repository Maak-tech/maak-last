/**
 * Fall Risk Service (client-side)
 *
 * Reads and interprets the `fallRisk` component from a user's Virtual Health
 * Identity. Provides score labels, colour codes, driver explanations, and
 * threshold helpers for use in UI components and Nora's context.
 *
 * The actual fallRisk score is computed server-side by `vhiCycle.ts` every
 * 15 minutes and stored in `vhi.data.currentState.riskScores.fallRisk`.
 * This service exposes read-only helpers — it does NOT recompute the score.
 *
 * Fall risk drivers modelled by the server:
 *   - Number of fall events detected (primary signal)
 *   - Symptom burden (high-severity symptoms add instability signal)
 *   - HRV deviation (low HRV → autonomic stress → fall risk)
 *   - Sleep deficit (fatigue correlates with falls)
 *   - Medication adherence (missed meds can cause dizziness / orthostatic issues)
 */

import type { VHI } from "@/lib/services/vhiService";

// ── Thresholds ────────────────────────────────────────────────────────────────

export const FALL_RISK_THRESHOLDS = {
  CRITICAL: 85,
  HIGH: 70,
  MODERATE: 50,
  LOW: 0,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FallRiskLevel = "low" | "moderate" | "high" | "critical";

export type FallRiskSummary = {
  score: number;
  level: FallRiskLevel;
  label: string;
  labelAr: string;
  /** Primary drivers contributing to the score */
  drivers: string[];
  /** Whether immediate clinical attention is warranted */
  requiresAttention: boolean;
  /** One-sentence guidance for the patient or caregiver */
  guidance: string;
  guidanceAr: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Classify a fall risk score (0–100) into a risk level.
 */
export function getFallRiskLevel(score: number): FallRiskLevel {
  if (score >= FALL_RISK_THRESHOLDS.CRITICAL) return "critical";
  if (score >= FALL_RISK_THRESHOLDS.HIGH)     return "high";
  if (score >= FALL_RISK_THRESHOLDS.MODERATE) return "moderate";
  return "low";
}

/**
 * Return a hex colour for a given risk level.
 * Uses standard Nuralix severity palette.
 */
export function getFallRiskColor(
  level: FallRiskLevel,
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
 * Build a human-readable fall risk summary from a VHI object.
 * Returns `null` if the VHI has not been computed yet or has no fall risk data.
 */
export function buildFallRiskSummary(vhi: VHI | null): FallRiskSummary | null {
  const fallRisk = vhi?.data?.currentState?.riskScores?.fallRisk;
  if (!fallRisk) return null;

  const score = Math.round(fallRisk.score);
  const level = getFallRiskLevel(score);

  const labels: Record<FallRiskLevel, { en: string; ar: string }> = {
    critical: { en: "Critical fall risk",  ar: "خطر سقوط حرج" },
    high:     { en: "High fall risk",      ar: "خطر سقوط مرتفع" },
    moderate: { en: "Moderate fall risk",  ar: "خطر سقوط متوسط" },
    low:      { en: "Low fall risk",       ar: "خطر سقوط منخفض" },
  };

  const guidanceMap: Record<FallRiskLevel, { en: string; ar: string }> = {
    critical: {
      en: "Multiple fall events detected — contact your care team today.",
      ar: "تم رصد سقطات متعددة — تواصل مع فريق الرعاية اليوم.",
    },
    high: {
      en: "Your fall risk is elevated — ensure a safe home environment and inform your caregiver.",
      ar: "خطر السقوط مرتفع — تأكد من سلامة بيئتك المنزلية وأبلغ مقدم الرعاية.",
    },
    moderate: {
      en: "Your fall risk is slightly elevated — maintain regular activity and stay hydrated.",
      ar: "خطر السقوط مرتفع قليلاً — حافظ على النشاط المنتظم والترطيب.",
    },
    low: {
      en: "Your fall risk is well managed — keep up your healthy routines.",
      ar: "خطر السقوط منخفض — استمر في عاداتك الصحية.",
    },
  };

  return {
    score,
    level,
    label: labels[level].en,
    labelAr: labels[level].ar,
    drivers: fallRisk.drivers ?? [],
    requiresAttention: level === "critical" || level === "high",
    guidance: guidanceMap[level].en,
    guidanceAr: guidanceMap[level].ar,
  };
}

/**
 * Return a short score badge string, e.g. "82 / 100  HIGH".
 */
export function formatFallRiskBadge(score: number, isRTL = false): string {
  const level = getFallRiskLevel(score);
  const levelStr = level.toUpperCase();
  return isRTL
    ? `${levelStr}  ${score} / 100`
    : `${score} / 100  ${levelStr}`;
}

// ── Singleton-style default export ────────────────────────────────────────────

const fallRiskService = {
  getLevel:     getFallRiskLevel,
  getColor:     getFallRiskColor,
  buildSummary: buildFallRiskSummary,
  formatBadge:  formatFallRiskBadge,
  THRESHOLDS:   FALL_RISK_THRESHOLDS,
};

export default fallRiskService;
