/**
 * useMedicationIntelligence hook
 * Checks interactions and refill predictions with 15-minute TTL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkInteractions,
  type InteractionWarning,
  predictRefills,
  type RefillPrediction,
} from "@/lib/services/medicationIntelligenceService";
import { medicationService } from "@/lib/services/medicationService";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

type UseMedicationIntelligenceReturn = {
  interactions: InteractionWarning[];
  refills: RefillPrediction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useMedicationIntelligence(
  userId: string | undefined
): UseMedicationIntelligenceReturn {
  const [interactions, setInteractions] = useState<InteractionWarning[]>([]);
  const [refills, setRefills] = useState<RefillPrediction[]>([]);
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
        interactions.length > 0
      )
        return;

      setLoading(true);
      setError(null);
      try {
        const meds = await medicationService.getUserMedications(userId);
        const [interactionResults, refillResults] = await Promise.all([
          Promise.resolve(checkInteractions(meds)),
          Promise.resolve(predictRefills(meds)),
        ]);
        setInteractions(interactionResults);
        setRefills(refillResults);
        lastLoadRef.current = Date.now();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load medication intelligence"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, interactions.length]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { interactions, refills, loading, error, refresh };
}
