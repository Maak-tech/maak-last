/**
 * useSymptomAnalysis hook
 * Runs ML symptom pattern recognition with a 30-minute TTL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PatternAnalysisResult,
  symptomPatternRecognitionService,
} from "@/lib/services/symptomPatternRecognitionService";
import { symptomService } from "@/lib/services/symptomService";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type UseSymptomAnalysisReturn = {
  analysis: PatternAnalysisResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useSymptomAnalysis(
  userId: string | undefined,
  isArabic = false
): UseSymptomAnalysisReturn {
  const [analysis, setAnalysis] = useState<PatternAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (!force && now - lastLoadRef.current < CACHE_TTL_MS && analysis)
        return;

      setLoading(true);
      setError(null);
      try {
        const recentSymptoms = await symptomService
          .getUserSymptoms(userId, 50)
          .catch(() => []);
        const result =
          await symptomPatternRecognitionService.analyzeSymptomPatterns(
            userId,
            recentSymptoms,
            undefined,
            undefined,
            isArabic
          );
        setAnalysis(result);
        lastLoadRef.current = Date.now();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to analyze symptoms"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, isArabic, analysis]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { analysis, loading, error, refresh };
}
