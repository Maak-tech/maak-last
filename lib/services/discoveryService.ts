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

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import type { HealthDiscovery } from "@/types/discoveries";

export type DiscoveryType =
  | "correlation"
  | "symptom_pattern"
  | "vital_trend"
  | "medication_effectiveness";

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
  const q = query(
    collection(db, "vitals"),
    where("userId", "==", userId),
    where("timestamp", ">=", Timestamp.fromDate(since)),
    orderBy("timestamp", "desc"),
    limit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type as string,
      value: data.value as number,
      unit: data.unit as string | undefined,
      timestamp:
        data.timestamp instanceof Timestamp
          ? data.timestamp.toDate()
          : new Date(),
      source: data.source as string | undefined,
    };
  });
}

/** Convert a PatternInsight to the HealthDiscovery shape (for unified rendering) */
function patternInsightToDiscovery(
  insight: PatternInsight,
  type: DiscoveryType,
  userId: string,
  idx: number
): EnrichedDiscovery {
  return {
    id: `${type}_${idx}_${Date.now()}`,
    userId,
    // Map PatternInsight.type → DiscoveryCategory approximation
    category: type === "vital_trend" ? "symptom_vital" : "temporal_pattern",
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
    const symptoms = await symptomService.getUserSymptoms(userId, 200).catch(() => []);
    if (symptoms.length < 3) return [];

    const analysis = await symptomPatternRecognitionService.analyzeSymptomPatterns(
      userId,
      symptoms,
      undefined,
      undefined,
      isArabic
    );

    return analysis.patterns
      .filter((p) => p.confidence >= 40) // Only reasonably confident patterns
      .map((p, idx): EnrichedDiscovery => ({
        id: `symptom_pattern_${idx}_${Date.now()}`,
        userId,
        category: "temporal_pattern",
        title: p.name,
        description: p.description,
        strength: p.severity === "severe" ? 0.9 : p.severity === "moderate" ? 0.65 : 0.4,
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
      }));
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
    const medications = await medicationService.getUserMedications(userId).catch(() => []);
    if (medications.length === 0) return [];

    const insights = await Promise.all(
      medications.slice(0, 5).map((med) =>
        getEffectivenessInsights(userId, med.id, med.name).catch(() => null)
      )
    );

    return insights
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .map((insight, idx): EnrichedDiscovery => ({
        id: `med_effectiveness_${idx}_${Date.now()}`,
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
      }));
  } catch {
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Get all non-dismissed discoveries for a user, newest first */
export async function getAllDiscoveries(
  userId: string,
  isArabic = false
): Promise<EnrichedDiscovery[]> {
  const [correlations, symptomPatterns, vitalTrends, medEffectiveness] =
    await Promise.allSettled([
      fetchCorrelationDiscoveries(userId, isArabic),
      fetchSymptomPatternDiscoveries(userId, isArabic),
      fetchVitalTrendDiscoveries(userId, isArabic),
      fetchMedicationEffectivenessDiscoveries(userId, isArabic),
    ]);

  const all: EnrichedDiscovery[] = [
    ...(correlations.status === "fulfilled" ? correlations.value : []),
    ...(symptomPatterns.status === "fulfilled" ? symptomPatterns.value : []),
    ...(vitalTrends.status === "fulfilled" ? vitalTrends.value : []),
    ...(medEffectiveness.status === "fulfilled" ? medEffectiveness.value : []),
  ];

  // Sort: new status first, then by confidence descending
  all.sort((a, b) => {
    if (a.status === "new" && b.status !== "new") return -1;
    if (b.status === "new" && a.status !== "new") return 1;
    return b.confidence - a.confidence;
  });

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
};
