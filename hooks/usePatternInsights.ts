/**
 * usePatternInsights hook
 *
 * Aggregates PatternInsight items from healthPatternDetectionService:
 *  - Temporal patterns (weekend/weekday symptom & mood shifts)
 *  - Vital sign trends (worsening/improving vitals)
 *  - Wearable integration-specific insights (glucose, sleep, HRV, steps)
 *  - Medication correlations
 *
 * Returns a prioritised flat list, newest/most-actionable first.
 * 30-minute TTL cache.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import {
  detectIntegrationSpecificInsights,
  detectMedicationCorrelations,
  detectTemporalPatterns,
  detectVitalTrends,
  type PatternInsight,
  type VitalSample,
} from "@/lib/services/healthPatternDetectionService";
import { medicationService } from "@/lib/services/medicationService";
import { moodService } from "@/lib/services/moodService";
import { symptomService } from "@/lib/services/symptomService";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

type UsePatternInsightsReturn = {
  insights: PatternInsight[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function fetchRecentVitals(
  userId: string,
  days = 30
): Promise<VitalSample[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const raw = await api.get<Record<string, unknown>[]>(
    `/api/health/vitals?from=${since.toISOString()}&limit=200`
  ).catch(() => []);
  return (raw ?? []).map((d) => ({
    id: d.id as string,
    type: d.type as string,
    value: d.value as number,
    unit: d.unit as string | undefined,
    timestamp: d.recordedAt ? new Date(d.recordedAt as string) : new Date(),
    source: d.source as string | undefined,
  }));
}

export function usePatternInsights(
  userId: string | undefined,
  isArabic = false
): UsePatternInsightsReturn {
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (
        !force &&
        now - lastLoadRef.current < CACHE_TTL_MS &&
        insights.length > 0
      )
        return;

      setLoading(true);
      setError(null);
      try {
        const [symptoms, moods, medications, vitals] = await Promise.all([
          symptomService.getUserSymptoms(userId, 200).catch(() => []),
          moodService.getUserMoods(userId, 100).catch(() => []),
          medicationService.getUserMedications(userId).catch(() => []),
          fetchRecentVitals(userId, 30).catch(() => [] as VitalSample[]),
        ]);

        const temporal = detectTemporalPatterns(symptoms, moods, isArabic);
        const medCorr = detectMedicationCorrelations(
          symptoms,
          medications,
          isArabic
        );
        const vitalTrends = detectVitalTrends(vitals, isArabic, userId, false);
        const integrationInsights = detectIntegrationSpecificInsights(
          vitals,
          isArabic
        );

        const all = [
          ...temporal,
          ...medCorr,
          ...vitalTrends,
          ...integrationInsights,
        ];

        // Prioritise: actionable first, then by confidence descending
        all.sort((a, b) => {
          if (a.actionable && !b.actionable) return -1;
          if (!a.actionable && b.actionable) return 1;
          return b.confidence - a.confidence;
        });

        setInsights(all);
        lastLoadRef.current = Date.now();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load pattern insights"
        );
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, isArabic]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { insights, loading, error, refresh };
}
