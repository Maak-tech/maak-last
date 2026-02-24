/**
 * usePredictiveScore hook
 * Fetches and caches 7-day health score forecast with 30-minute TTL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPredictiveForecast,
  type HealthScoreForecast,
} from "@/lib/services/predictiveHealthScoreService";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type UsePredictiveScoreReturn = {
  forecast: HealthScoreForecast | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function usePredictiveScore(
  userId: string | undefined
): UsePredictiveScoreReturn {
  const [forecast, setForecast] = useState<HealthScoreForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);
  const hasDataRef = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (!force && now - lastLoadRef.current < CACHE_TTL_MS && hasDataRef.current)
        return;

      setLoading(true);
      setError(null);
      try {
        const data = await getPredictiveForecast(userId, 7);
        setForecast(data);
        lastLoadRef.current = Date.now();
        hasDataRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load forecast"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { forecast, loading, error, refresh };
}
