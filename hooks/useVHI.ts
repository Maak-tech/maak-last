/**
 * useVHI hook
 *
 * Fetches and caches the current user's Virtual Health Identity with a
 * 5-minute TTL. Exposes `refresh()` for pull-to-refresh and an `acknowledge()`
 * helper that calls the API and optimistically removes the action from state.
 *
 * Usage:
 *   const { vhi, loading, error, refresh, acknowledge } = useVHI(userId);
 */

import { useCallback, useEffect, useRef, useState } from "react";
import vhiService, { type VHI } from "@/lib/services/vhiService";

const VHI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type UseVHIReturn = {
  vhi: VHI | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Acknowledge a pending VHI action by its ID and update state optimistically */
  acknowledge: (actionId: string) => Promise<void>;
};

export function useVHI(userId: string | undefined): UseVHIReturn {
  const [vhi, setVhi] = useState<VHI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);
  const hasDataRef = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (!force && now - lastLoadRef.current < VHI_CACHE_TTL_MS && hasDataRef.current)
        return;

      setLoading(true);
      setError(null);
      try {
        const data = await vhiService.getMyVHI();
        setVhi(data);
        lastLoadRef.current = Date.now();
        hasDataRef.current = !!data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load VHI");
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

  const acknowledge = useCallback(
    async (actionId: string) => {
      // Optimistic UI — remove from pending list immediately
      setVhi((prev) => {
        if (!prev?.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            pendingActions: prev.data.pendingActions.map((a) =>
              a.id === actionId ? { ...a, acknowledged: true } : a
            ),
          },
        };
      });
      // Fire API call in background
      await vhiService.acknowledgeAction(actionId);
    },
    []
  );

  return { vhi, loading, error, refresh, acknowledge };
}
