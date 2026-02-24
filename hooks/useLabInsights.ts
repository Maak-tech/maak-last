/**
 * useLabInsights hook
 * Fetches and caches lab insights analysis with 1-hour TTL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeLabResults,
  type LabInsightsSummary,
} from "@/lib/services/labInsightsService";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type UseLabInsightsReturn = {
  insights: LabInsightsSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useLabInsights(
  userId: string | undefined
): UseLabInsightsReturn {
  const [insights, setInsights] = useState<LabInsightsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (!force && now - lastLoadRef.current < CACHE_TTL_MS && insights)
        return;

      setLoading(true);
      setError(null);
      try {
        const data = await analyzeLabResults(userId, force);
        setInsights(data);
        lastLoadRef.current = Date.now();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load lab insights"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, insights]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { insights, loading, error, refresh };
}
