/**
 * useGeneticsProfile hook
 *
 * Fetches and caches the current user's genetics profile with a 10-minute TTL.
 * Exposes `refresh()` for pull-to-refresh and an `updateConsent()` helper
 * that calls the API and updates state optimistically.
 *
 * Usage:
 *   const { profile, status, loading, error, refresh, updateConsent } = useGeneticsProfile(userId);
 */

import { useCallback, useEffect, useRef, useState } from "react";
import geneticsService, {
  type GeneticsProfile,
  type GeneticsStatus,
} from "@/lib/services/geneticsService";

const GENETICS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type UseGeneticsProfileReturn = {
  profile: GeneticsProfile | null;
  /** Lightweight status — available even before the full profile loads */
  status: GeneticsStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Update family-sharing consent and optimistically update local state */
  updateConsent: (familySharingConsent: boolean) => Promise<void>;
};

export function useGeneticsProfile(
  userId: string | undefined
): UseGeneticsProfileReturn {
  const [profile, setProfile] = useState<GeneticsProfile | null>(null);
  const [status, setStatus] = useState<GeneticsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef<number>(0);
  const hasDataRef = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (!userId) return;
      const now = Date.now();
      if (
        !force &&
        now - lastLoadRef.current < GENETICS_CACHE_TTL_MS &&
        hasDataRef.current
      )
        return;

      setLoading(true);
      setError(null);
      try {
        // Fetch full profile and status in parallel
        const [profileData, statusData] = await Promise.all([
          geneticsService.getProfile(),
          geneticsService.getStatus(),
        ]);
        setProfile(profileData);
        setStatus(statusData);
        lastLoadRef.current = Date.now();
        hasDataRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load genetics profile"
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

  const updateConsent = useCallback(
    async (familySharingConsent: boolean) => {
      // Optimistic UI — update local state immediately
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, familySharingConsent };
      });
      // Fire API call
      await geneticsService.updateConsent(familySharingConsent);
    },
    []
  );

  return { profile, status, loading, error, refresh, updateConsent };
}
