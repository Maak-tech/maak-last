/**
 * Trend Alert Service — Firebase-free replacement.
 *
 * Replaced Firestore reads on `vitals` and `symptoms` collections with:
 *   GET /api/health/vitals?from=...&limit=50  → recent vitals for trend analysis
 *   GET /api/health/symptoms?from=...&limit=50 → recent symptoms for trend analysis
 *
 * Automatically checks for concerning trends when new health data is added
 * and creates alerts that are picked up by the real-time WebSocket service.
 */
/* biome-ignore-all lint/complexity/noForEach: Snapshot-to-group transforms use forEach in this legacy trend check path. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Trend checks intentionally combine vital and symptom aggregation with alert dispatch. */

import { api } from "@/lib/apiClient";
import {
  analyzeSymptomTrend,
  analyzeVitalTrend,
  createTrendAlert,
  isTrendConcerning,
} from "./trendDetectionService";

/**
 * Check for concerning trends when a new vital is added.
 * This should be called after a vital is saved.
 */
export async function checkTrendsForNewVital(
  userId: string,
  vitalType: string,
  unit: string
): Promise<void> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/vitals?from=${sevenDaysAgo.toISOString()}&limit=50`
    );

    // Filter by type client-side (the API does not support a type query param)
    const readings = (raw ?? [])
      .filter((d) => d.type === vitalType)
      .map((d) => ({
        value: typeof d.value === "number" ? d.value : Number.parseFloat(String(d.value ?? 0)),
        timestamp: d.recordedAt ? new Date(d.recordedAt as string) : new Date(),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (readings.length < 3) return; // Not enough data for trend analysis

    const trendAnalysis = analyzeVitalTrend(readings, vitalType, unit, 7);

    if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
      await createTrendAlert(userId, trendAnalysis, "vital_trend");
    }
  } catch {
    // Don't throw - trend checking is non-critical
  }
}

/**
 * Check for concerning trends when a new symptom is added.
 * This should be called after a symptom is saved.
 */
export async function checkTrendsForNewSymptom(
  userId: string,
  symptomType: string
): Promise<void> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/symptoms?from=${sevenDaysAgo.toISOString()}&limit=50`
    );

    // Filter by type client-side
    const readings = (raw ?? [])
      .filter((d) => d.type === symptomType)
      .map((d) => ({
        type: d.type as string,
        severity: typeof d.severity === "number" ? d.severity : Number(d.severity ?? 1),
        timestamp: d.recordedAt ? new Date(d.recordedAt as string) : new Date(),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (readings.length === 0) return;

    const trendAnalysis = analyzeSymptomTrend(readings, symptomType, 7);

    if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
      await createTrendAlert(userId, trendAnalysis, "symptom_trend");
    }
  } catch {
    // Don't throw - trend checking is non-critical
  }
}

/**
 * Batch check trends for all vital types for a user.
 * Useful for periodic checks or after bulk data imports.
 */
export async function checkAllTrendsForUser(userId: string): Promise<void> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all vitals and symptoms for the window in parallel
    const [rawVitals, rawSymptoms] = await Promise.all([
      api.get<Record<string, unknown>[]>(
        `/api/health/vitals?from=${sevenDaysAgo.toISOString()}&limit=200`
      ).catch(() => [] as Record<string, unknown>[]),
      api.get<Record<string, unknown>[]>(
        `/api/health/symptoms?from=${sevenDaysAgo.toISOString()}&limit=200`
      ).catch(() => [] as Record<string, unknown>[]),
    ]);

    // Group vitals by type
    const vitalsByType: Record<string, Array<{ value: number; timestamp: Date; unit: string }>> = {};
    for (const d of rawVitals ?? []) {
      const type = d.type as string;
      const value = typeof d.value === "number" ? d.value : Number.parseFloat(String(d.value ?? 0));
      const unit = (d.unit as string) || "";
      const timestamp = d.recordedAt ? new Date(d.recordedAt as string) : new Date();

      if (type && !Number.isNaN(value)) {
        if (!vitalsByType[type]) vitalsByType[type] = [];
        vitalsByType[type].push({ value, timestamp, unit });
      }
    }

    // Check trends for each vital type
    for (const [type, readings] of Object.entries(vitalsByType)) {
      if (readings.length < 3) continue;
      const sorted = readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const trendAnalysis = analyzeVitalTrend(
        sorted.map((r) => ({ value: r.value, timestamp: r.timestamp })),
        type,
        sorted[0]?.unit || "",
        7
      );
      if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
        await createTrendAlert(userId, trendAnalysis, "vital_trend");
      }
    }

    // Group symptoms by type
    const symptomsByType: Record<string, Array<{ type: string; severity: number; timestamp: Date }>> = {};
    for (const d of rawSymptoms ?? []) {
      const type = d.type as string;
      const severity = typeof d.severity === "number" ? d.severity : Number(d.severity ?? 1);
      const timestamp = d.recordedAt ? new Date(d.recordedAt as string) : new Date();
      if (type) {
        if (!symptomsByType[type]) symptomsByType[type] = [];
        symptomsByType[type].push({ type, severity, timestamp });
      }
    }

    // Check trends for each symptom type
    for (const [type, readings] of Object.entries(symptomsByType)) {
      if (readings.length === 0) continue;
      const sorted = readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const trendAnalysis = analyzeSymptomTrend(sorted, type, 7);
      if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
        await createTrendAlert(userId, trendAnalysis, "symptom_trend");
      }
    }
  } catch {
    // Don't throw - trend checking is non-critical
  }
}
