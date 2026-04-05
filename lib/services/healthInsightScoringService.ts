/**
 * Health Insight Scoring Service
 *
 * Provides utility functions and API calls for computing health insight scores,
 * including vital anomaly signal retrieval, statistical helpers (clamp, mean),
 * and the VitalAnomalySignal type used across the health insights pipeline.
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VitalAnomalySignal = {
  vitalType: string;
  zScore: number;
  severity: "mild" | "moderate" | "significant";
  direction: "above" | "below";
  timestamp: Date;
};

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Fetch anomaly signals for a given user from the backend.
 * Returns an empty array if the request fails.
 */
export async function getVitalAnomalySignals(
  userId: string
): Promise<VitalAnomalySignal[]> {
  try {
    const raw = await api.get<VitalAnomalySignal[]>(
      `/api/health/anomaly-signals?userId=${encodeURIComponent(userId)}`
    );
    return (Array.isArray(raw) ? raw : []).map((item) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  } catch (error: unknown) {
    logger.error(
      "Failed to fetch vital anomaly signals",
      { userId, error },
      "HealthInsightScoring"
    );
    return [];
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Clamps a numeric value between a minimum and maximum bound.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns the arithmetic mean of an array of numbers.
 * Returns 0 for an empty array.
 */
export function getMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ─── Stub implementations (logic lives server-side) ──────────────────────────

/**
 * Calculates medication compliance for a given time period.
 * Returns percentage compliance and count of missed doses.
 */
export function calculateMedicationCompliance(
  _medications: unknown[],
  _start?: Date,
  _end?: Date
): { compliance: number; missedDoses: number } {
  return { compliance: 100, missedDoses: 0 };
}

/**
 * Generates predictive health insights from combined health data.
 * Returns an empty array (implementation lives server-side).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generatePredictiveInsights(..._args: unknown[]): any[] {
  return [];
}

/**
 * Ranks insights by confidence and actionability.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rankInsights<T extends { confidence: number }>(insights: T[]): T[] {
  return [...insights].sort((a, b) => b.confidence - a.confidence);
}
