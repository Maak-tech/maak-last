/**
 * React hook for accessing health correlation discoveries.
 * Follows the same caching pattern as useAIInsights.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { correlationDiscoveryService } from "@/lib/services/correlationDiscoveryService";
import type { DiscoveryCategory, HealthDiscovery } from "@/types/discoveries";

type UseCorrelationDiscoveriesOptions = {
  autoLoad?: boolean;
  cacheTimeout?: number; // minutes
  isArabic?: boolean;
};

type UseCorrelationDiscoveriesReturn = {
  discoveries: HealthDiscovery[];
  topDiscoveries: HealthDiscovery[];
  newDiscoveries: HealthDiscovery[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markSeen: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  filterByCategory: (category: DiscoveryCategory) => HealthDiscovery[];
};

export function useCorrelationDiscoveries(
  userId: string | undefined,
  options: UseCorrelationDiscoveriesOptions = {}
): UseCorrelationDiscoveriesReturn {
  const { autoLoad = true, cacheTimeout = 15, isArabic = false } = options;

  const [discoveries, setDiscoveries] = useState<HealthDiscovery[]>([]);
  const [topDiscoveries, setTopDiscoveries] = useState<HealthDiscovery[]>([]);
  const [newDiscoveries, setNewDiscoveries] = useState<HealthDiscovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache management
  const lastLoadTimeRef = useRef<Date | null>(null);
  const hasLoadedRef = useRef(false);

  const isCacheValid = useCallback(() => {
    if (!lastLoadTimeRef.current) return false;
    const diffMinutes =
      (Date.now() - lastLoadTimeRef.current.getTime()) / (1000 * 60);
    return diffMinutes < cacheTimeout;
  }, [cacheTimeout]);

  const loadDiscoveries = useCallback(
    async (force = false) => {
      if (!userId) return;
      if (!force && isCacheValid() && hasLoadedRef.current) return;

      try {
        setLoading(true);
        setError(null);

        // On first load or force refresh, run the full refresh pipeline
        if (force || !hasLoadedRef.current) {
          await correlationDiscoveryService.refreshDiscoveries(
            userId,
            isArabic
          );
        }

        const [all, top, recent] = await Promise.all([
          correlationDiscoveryService.getDiscoveries(userId),
          correlationDiscoveryService.getTopDiscoveries(userId, 3),
          correlationDiscoveryService.getNewDiscoveriesSince(
            userId,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // last 7 days
          ),
        ]);

        setDiscoveries(all);
        setTopDiscoveries(top);
        setNewDiscoveries(recent);
        lastLoadTimeRef.current = new Date();
        hasLoadedRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load discoveries"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, isArabic, isCacheValid]
  );

  const refresh = useCallback(async () => {
    await loadDiscoveries(true);
  }, [loadDiscoveries]);

  const markSeen = useCallback(
    async (discoveryId: string) => {
      if (!userId) return;
      await correlationDiscoveryService.markAsSeen(userId, discoveryId);
      setDiscoveries((prev) =>
        prev.map((d) =>
          d.id === discoveryId ? { ...d, status: "seen" as const } : d
        )
      );
      setNewDiscoveries((prev) => prev.filter((d) => d.id !== discoveryId));
    },
    [userId]
  );

  const dismiss = useCallback(
    async (discoveryId: string) => {
      if (!userId) return;
      await correlationDiscoveryService.markAsDismissed(userId, discoveryId);
      setDiscoveries((prev) =>
        prev.map((d) =>
          d.id === discoveryId ? { ...d, status: "dismissed" as const } : d
        )
      );
      setTopDiscoveries((prev) => prev.filter((d) => d.id !== discoveryId));
      setNewDiscoveries((prev) => prev.filter((d) => d.id !== discoveryId));
    },
    [userId]
  );

  const filterByCategory = useCallback(
    (category: DiscoveryCategory) =>
      discoveries.filter((d) => d.category === category),
    [discoveries]
  );

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && userId) {
      loadDiscoveries();
    }
  }, [autoLoad, userId, loadDiscoveries]);

  return {
    discoveries,
    topDiscoveries,
    newDiscoveries,
    loading,
    error,
    refresh,
    markSeen,
    dismiss,
    filterByCategory,
  };
}
