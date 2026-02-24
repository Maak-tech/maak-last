/**
 * useProactiveMonitor hook
 *
 * Loads the user's personalised health baseline, then compares current state
 * to detect meaningful deviations across ALL health dimensions:
 *   vitals, mood, symptoms, sleep, steps, medication adherence, women's health
 *
 * Cache: baseline 24h (persisted in Firestore), deviations 1h (in-memory)
 *
 * Returns:
 *  - baseline: UserHealthBaseline | null
 *  - deviations: BaselineDeviation[]
 *  - loading: boolean
 *  - error: string | null
 *  - refresh: () => Promise<void>
 *  - hasCriticalChange: boolean (any "significant" deviation)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  userBaselineService,
  type BaselineDeviation,
  type UserHealthBaseline,
} from "@/lib/services/userBaselineService";

const DEVIATIONS_CACHE_MS = 60 * 60 * 1000; // 1 hour

type UseProactiveMonitorReturn = {
  baseline: UserHealthBaseline | null;
  deviations: BaselineDeviation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasCriticalChange: boolean;
};

export function useProactiveMonitor(
  userId: string | undefined,
  isArabic = false
): UseProactiveMonitorReturn {
  const [baseline, setBaseline] = useState<UserHealthBaseline | null>(null);
  const [deviations, setDeviations] = useState<BaselineDeviation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (!force && now - lastLoadRef.current < DEVIATIONS_CACHE_MS && baseline !== null)
        return;

      setLoading(true);
      setError(null);
      try {
        const b = force
          ? await userBaselineService.computeBaseline(userId)
          : await userBaselineService.getBaseline(userId);
        setBaseline(b);

        const devs = await userBaselineService.detectDeviations(userId, b, isArabic);
        setDeviations(devs);
        lastLoadRef.current = Date.now();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load health monitor"
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

  const hasCriticalChange = deviations.some((d) => d.severity === "significant");

  return { baseline, deviations, loading, error, refresh, hasCriticalChange };
}
