/**
 * Unified Discovery Service
 *
 * Aggregates all discovery types into a single ranked feed:
 *   1. Correlation discoveries (symptom-medication / mood-vital / etc.)
 *   2. Symptom pattern discoveries (clusters detected by symptomPatternRecognitionService)
 *   3. Vital trend discoveries (significant vital sign trends)
 *   4. Medication effectiveness discoveries
 *
 * Each EnrichedDiscovery extends HealthDiscovery (required by CorrelationDiscoveryCard)
 * and adds a `discoveryType` discriminator for filter chips on the discoveries screen.
 */

import { api } from "@/lib/apiClient";
import type { HealthDiscovery } from "@/types/discoveries";
import { correlationDiscoveryService } from "./correlationDiscoveryService";
import {
  detectIntegrationSpecificInsights,
  detectMedicationCorrelations,
  detectTemporalPatterns,
  detectVitalTrends,
  type PatternInsight,
  type VitalSample,
} from "./healthPatternDetectionService";
import { getEffectivenessInsights } from "./medicationIntelligenceService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { symptomPatternRecognitionService } from "./symptomPatternRecognitionService";
import { symptomService } from "./symptomService";

export type DiscoveryType =
  | "correlation"
  | "symptom_pattern"
  | "vital_trend"
  | "medication_effectiveness"
  | "temporal_pattern"
  | "medication_pattern"
  | "integration_insight";

export type EnrichedDiscovery = HealthDiscovery & {
  discoveryType: DiscoveryType;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchRecentVitals(
  userId: string,
  days = 30
): Promise<VitalSample[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const raw = await api.get<Record<string, unknown>[]>(
    `/api/health/vitals?from=${since.toISOString()}&limit=200`
  );
  return (raw ?? []).map((v) => ({
    id: (v.id as string | undefined) ?? "",
    type: v.type as string,
    value: v.value as number,
    unit: v.unit as string | undefined,
    timestamp: v.recordedAt ? new Date(v.recordedAt as string) : new Date(),
    source: v.source as string | undefined,
  }));
}

/**
 * Build a stable discovery ID from its content so that dismiss persists
 * across app sessions. IDs are deterministic per (userId, type, title).
 */
function stableDiscoveryId(
  type: DiscoveryType,
  userId: string,
  key: string
): string {
  // Simple djb2-style hash — no crypto needed, just collision-resistance
  let hash = 5381;
  const str = `${type}:${userId}:${key}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit hex
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `${type}_${hex}`;
}

/** Convert a PatternInsight to the HealthDiscovery shape (for unified rendering) */
function patternInsightToDiscovery(
  insight: PatternInsight,
  type: DiscoveryType,
  userId: string,
  idx: number
): EnrichedDiscovery {
  // Map DiscoveryType → the closest DiscoveryCategory for colour/label rendering
  const categoryMap: Record<
    DiscoveryType,
    import("@/types/discoveries").DiscoveryCategory
  > = {
    vital_trend: "symptom_vital",
    temporal_pattern: "temporal_pattern",
    medication_pattern: "medication_vital",
    integration_insight: "symptom_vital",
    correlation: "symptom_vital",
    symptom_pattern: "temporal_pattern",
    medication_effectiveness: "medication_vital",
  };

  return {
    id: stableDiscoveryId(type, userId, insight.title),
    userId,
    category: categoryMap[type] ?? "temporal_pattern",
    title: insight.title,
    description: insight.description,
    strength: insight.confidence / 100,
    confidence: insight.confidence,
    actionable: insight.actionable ?? false,
    recommendation: insight.recommendation,
    dataPoints: 0,
    periodDays: 30,
    factor1: insight.type,
    factor2: type,
    status: "new",
    discoveredAt: new Date(),
    lastUpdatedAt: new Date(),
    discoveryType: type,
  };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchCorrelationDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const result = await correlationDiscoveryService.refreshDiscoveries(
      userId,
      isArabic
    );
    return (result.discoveries ?? [])
      .filter((d) => d.status !== "dismissed")
      .map((d) => ({ ...d, discoveryType: "correlation" as DiscoveryType }));
  } catch {
    return [];
  }
}

async function fetchSymptomPatternDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const symptoms = await symptomService
      .getUserSymptoms(userId, 200)
      .catch(() => []);
    if (symptoms.length < 3) return [];

    const analysis =
      await symptomPatternRecognitionService.analyzeSymptomPatterns(
        userId,
        symptoms,
        undefined,
        undefined,
        isArabic
      );

    return analysis.patterns
      .filter((p) => p.confidence >= 40) // Only reasonably confident patterns
      .map(
        (p, _idx): EnrichedDiscovery => ({
          id: stableDiscoveryId("symptom_pattern", userId, p.name),
          userId,
          category: "temporal_pattern",
          title: p.name,
          description: p.description,
          strength:
            p.severity === "severe"
              ? 0.9
              : p.severity === "moderate"
                ? 0.65
                : 0.4,
          confidence: p.confidence,
          actionable: true,
          recommendation: undefined,
          dataPoints: p.symptoms.length,
          periodDays: 30,
          factor1: "symptom",
          factor2: p.name,
          status: "new",
          discoveredAt: new Date(),
          lastUpdatedAt: new Date(),
          discoveryType: "symptom_pattern",
        })
      );
  } catch {
    return [];
  }
}

async function fetchVitalTrendDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const vitals = await fetchRecentVitals(userId, 30);
    if (vitals.length < 5) return [];

    const insights = detectVitalTrends(vitals, isArabic, userId, false);

    return insights
      .filter((i) => i.confidence >= 50)
      .map((insight, idx) =>
        patternInsightToDiscovery(insight, "vital_trend", userId, idx)
      );
  } catch {
    return [];
  }
}

async function fetchMedicationEffectivenessDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const medications = await medicationService
      .getUserMedications(userId)
      .catch(() => []);
    if (medications.length === 0) return [];

    const insights = await Promise.all(
      medications
        .slice(0, 5)
        .map((med) =>
          getEffectivenessInsights(userId, med.id, med.name).catch(() => null)
        )
    );

    return insights
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .map(
        (insight, _idx): EnrichedDiscovery => ({
          id: stableDiscoveryId(
            "medication_effectiveness",
            userId,
            insight.medicationName
          ),
          userId,
          category: "medication_vital",
          title: isArabic
            ? `فعالية ${insight.medicationName}`
            : `${insight.medicationName} Effectiveness`,
          description: isArabic ? insight.insightAr : insight.insight,
          strength: insight.takenAvg > insight.missedAvg ? 0.7 : -0.5,
          confidence: 75,
          actionable: true,
          recommendation: isArabic
            ? `استمر في تناول ${insight.medicationName} كما هو موصوف`
            : `Continue taking ${insight.medicationName} as prescribed`,
          dataPoints: 0,
          periodDays: 30,
          factor1: insight.medicationName,
          factor2: isArabic ? insight.metricAr : insight.metric,
          status: "new",
          discoveredAt: new Date(),
          lastUpdatedAt: new Date(),
          discoveryType: "medication_effectiveness",
        })
      );
  } catch {
    return [];
  }
}

async function fetchTemporalPatternDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const [symptoms, moods] = await Promise.all([
      symptomService.getUserSymptoms(userId, 200).catch(() => []),
      moodService.getUserMoods(userId, 200).catch(() => []),
    ]);
    if (symptoms.length < 5 && moods.length < 5) return [];

    const insights = detectTemporalPatterns(symptoms, moods, isArabic);
    return insights
      .filter((i) => i.confidence >= 50)
      .map((insight, idx) =>
        patternInsightToDiscovery(insight, "temporal_pattern", userId, idx)
      );
  } catch {
    return [];
  }
}

async function fetchMedicationPatternDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const [symptoms, medications] = await Promise.all([
      symptomService.getUserSymptoms(userId, 200).catch(() => []),
      medicationService.getUserMedications(userId).catch(() => []),
    ]);
    if (symptoms.length < 5 || medications.length === 0) return [];

    const insights = detectMedicationCorrelations(
      symptoms,
      medications,
      isArabic
    );
    return insights
      .filter((i) => i.confidence >= 50)
      .map((insight, idx) =>
        patternInsightToDiscovery(insight, "medication_pattern", userId, idx)
      );
  } catch {
    return [];
  }
}

async function fetchIntegrationInsightDiscoveries(
  userId: string,
  isArabic: boolean
): Promise<EnrichedDiscovery[]> {
  try {
    const vitals = await fetchRecentVitals(userId, 30);
    if (vitals.length < 3) return [];

    const insights = detectIntegrationSpecificInsights(vitals, isArabic);
    return insights
      .filter((i) => i.confidence >= 50)
      .map((insight, idx) =>
        patternInsightToDiscovery(insight, "integration_insight", userId, idx)
      );
  } catch {
    return [];
  }
}

// ─── Dismissed-ID Persistence ─────────────────────────────────────────────────

// In-memory dismissed set — persisted as best-effort via timeline POST.
// Survives the session; on app restart the set resets (no dedicated GET endpoint yet).
const _dismissedIds: Map<string, Set<string>> = new Map();

/** Record a dismissed discovery ID (in-memory + best-effort timeline POST). */
export async function dismissDiscovery(
  userId: string,
  discoveryId: string
): Promise<void> {
  try {
    // Update in-memory set
    if (!_dismissedIds.has(userId)) _dismissedIds.set(userId, new Set());
    _dismissedIds.get(userId)!.add(discoveryId);
    // Invalidate cache so next load reflects the dismissal
    for (const key of _discoveryCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        _discoveryCache.delete(key);
      }
    }
    // Best-effort persist
    await api.post("/api/health/timeline", {
      userId,
      eventType: "discovery_dismissed",
      discoveryId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-critical — local dismiss already applied in UI
  }
}

/** Un-dismiss a previously dismissed discovery (restore it to the feed). */
export async function restoreDiscovery(
  userId: string,
  discoveryId: string
): Promise<void> {
  try {
    _dismissedIds.get(userId)?.delete(discoveryId);
  } catch {
    // Non-critical
  }
}

/** Fetch the set of IDs the user has dismissed. Returns in-memory set (empty on cold start). */
async function getDismissedIds(userId: string): Promise<Set<string>> {
  return _dismissedIds.get(userId) ?? new Set();
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Get all non-dismissed discoveries for a user, newest first */
// Service-level cache for discoveries (prevents redundant API calls on re-mount)
const _discoveryCache: Map<
  string,
  { data: EnrichedDiscovery[]; timestamp: number }
> = new Map();
const DISCOVERY_CACHE_TTL = 5 * 60_000; // 5 minutes

export async function getAllDiscoveries(
  userId: string,
  isArabic = false
): Promise<EnrichedDiscovery[]> {
  const cacheKey = `${userId}:${isArabic}`;
  const cached = _discoveryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DISCOVERY_CACHE_TTL) {
    return cached.data;
  }

  // Fetch dismissed IDs in parallel with the discovery fetchers
  const [
    dismissedResult,
    correlations,
    symptomPatterns,
    vitalTrends,
    medEffectiveness,
    temporalPatterns,
    medicationPatterns,
    integrationInsights,
  ] = await Promise.allSettled([
    getDismissedIds(userId),
    fetchCorrelationDiscoveries(userId, isArabic),
    fetchSymptomPatternDiscoveries(userId, isArabic),
    fetchVitalTrendDiscoveries(userId, isArabic),
    fetchMedicationEffectivenessDiscoveries(userId, isArabic),
    fetchTemporalPatternDiscoveries(userId, isArabic),
    fetchMedicationPatternDiscoveries(userId, isArabic),
    fetchIntegrationInsightDiscoveries(userId, isArabic),
  ]);

  const dismissedIds =
    dismissedResult.status === "fulfilled"
      ? dismissedResult.value
      : new Set<string>();

  const all: EnrichedDiscovery[] = [
    ...(correlations.status === "fulfilled" ? correlations.value : []),
    ...(symptomPatterns.status === "fulfilled" ? symptomPatterns.value : []),
    ...(vitalTrends.status === "fulfilled" ? vitalTrends.value : []),
    ...(medEffectiveness.status === "fulfilled" ? medEffectiveness.value : []),
    ...(temporalPatterns.status === "fulfilled" ? temporalPatterns.value : []),
    ...(medicationPatterns.status === "fulfilled"
      ? medicationPatterns.value
      : []),
    ...(integrationInsights.status === "fulfilled"
      ? integrationInsights.value
      : []),
  ].filter((d) => !dismissedIds.has(d.id));

  // Sort: new status first, then by confidence descending
  all.sort((a, b) => {
    if (a.status === "new" && b.status !== "new") return -1;
    if (b.status === "new" && a.status !== "new") return 1;
    return b.confidence - a.confidence;
  });

  // Cache the results
  _discoveryCache.set(cacheKey, { data: all, timestamp: Date.now() });

  return all;
}

/**
 * Get top N discoveries for the home screen — new items first, then by
 * confidence score.
 */
export async function getTopDiscoveries(
  userId: string,
  maxCount = 5,
  isArabic = false
): Promise<EnrichedDiscovery[]> {
  const all = await getAllDiscoveries(userId, isArabic);
  return all.slice(0, maxCount);
}

export const discoveryService = {
  getAllDiscoveries,
  getTopDiscoveries,
  dismissDiscovery,
  restoreDiscovery,
};
