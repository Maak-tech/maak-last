/**
 * useRecoveryScore hook
 * Fetches and caches the clinically-grounded Body Recovery Score with 30-minute TTL.
 * Recovery Score measures trajectory/momentum (improving vs. declining) across
 * HRV, sleep, resting heart rate, respiratory rate, and body temperature.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  recoveryScoreService,
  type RecoveryScoreResult,
} from "@/lib/services/recoveryScoreService";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type UseRecoveryScoreReturn = {
  recoveryScore: RecoveryScoreResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useRecoveryScore(
  userId: string | undefined
): UseRecoveryScoreReturn {
  const [recoveryScore, setRecoveryScore] =
    useState<RecoveryScoreResult | null>(null);
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
        const data = await recoveryScoreService.calculateRecoveryScore(userId);
        setRecoveryScore(data);
        lastLoadRef.current = Date.now();
        hasDataRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load recovery score"
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

  return { recoveryScore, loading, error, refresh };
}
