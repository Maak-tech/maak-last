/**
 * useHealthRisk hook
 * Fetches and caches the ML-powered health risk assessment with a 1-hour TTL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type HealthRiskAssessment,
  riskAssessmentService,
} from "@/lib/services/riskAssessmentService";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type UseHealthRiskReturn = {
  assessment: HealthRiskAssessment | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHealthRisk(
  userId: string | undefined,
  isArabic = false
): UseHealthRiskReturn {
  const [assessment, setAssessment] = useState<HealthRiskAssessment | null>(
    null
  );
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
        const data = await riskAssessmentService.generateRiskAssessment(
          userId,
          isArabic
        );
        setAssessment(data);
        lastLoadRef.current = Date.now();
        hasDataRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load risk assessment"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, isArabic]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { assessment, loading, error, refresh };
}
