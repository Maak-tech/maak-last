/**
 * useVHI hook
 *
 * Fetches and caches the current user's Virtual Health Identity with a
 * 5-minute TTL. Exposes `refresh()` for pull-to-refresh and an `acknowledge()`
 * helper that calls the API and optimistically removes the action from state.
 *
 * Real-time updates:
 *   The hook also maintains a WebSocket subscription to `/ws/vhi/:userId`.
 *   When the server broadcasts a `vhi.updated` event (fired by vhiCycle every
 *   15 minutes, or immediately after an anomaly), the hook automatically
 *   re-fetches the full VHI — so the VHI panel always reflects the latest
 *   computed health identity without any manual refresh.
 *
 * Usage:
 *   const { vhi, loading, error, refresh, acknowledge, isLive } = useVHI(userId);
 */

import { useCallback, useEffect, useRef, useState } from "react";
import vhiService, { type VHI } from "@/lib/services/vhiService";
import { useVHISocket } from "@/lib/hooks/useVHISocket";

const VHI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type UseVHIReturn = {
  vhi: VHI | null;
  loading: boolean;
  error: string | null;
  /** True when the WebSocket is connected and providing live updates */
  isLive: boolean;
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

  // ── Real-time WebSocket subscription ──────────────────────────────────────
  // When vhiCycle writes a new VHI row it calls broadcastToUser(userId, "vhi.updated").
  // We re-fetch the full VHI on that event so the panel reflects the latest scores
  // without the user needing to pull-to-refresh or wait for the 5-minute TTL.
  const { isConnected: isLive } = useVHISocket(userId, {
    onVHIUpdate: useCallback(() => {
      // The socket payload contains summary fields (score, riskLevel, trajectory)
      // but we always re-fetch the full VHI to keep state consistent with the DB.
      load(true);
    }, [load]),
  });

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
      // Fire API call in background — fire-and-forget, optimistic UI is already updated above
      vhiService.acknowledgeAction(actionId).catch((err) => {
        console.warn('[useVHI] acknowledgeAction failed (optimistic update already applied):', err instanceof Error ? err.message : String(err));
      });
    },
    []
  );

  return { vhi, loading, error, isLive, refresh, acknowledge };
}
