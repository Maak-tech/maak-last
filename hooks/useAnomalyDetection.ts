/**
 * React hook for accessing vital anomaly detection data.
 * Provides recent anomalies, stats, and baseline status.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { anomalyDetectionService } from "@/lib/services/anomalyDetectionService";
import type {
  AnomalyStats,
  BaselineStatus,
  VitalAnomaly,
} from "@/types/discoveries";

type UseAnomalyDetectionOptions = {
  autoLoad?: boolean;
  cacheTimeout?: number; // minutes
  historyDays?: number;
};

type UseAnomalyDetectionReturn = {
  recentAnomalies: VitalAnomaly[];
  anomalyStats: AnomalyStats | null;
  baselineStatuses: BaselineStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acknowledge: (anomalyId: string) => Promise<void>;
  ensureBaselines: () => Promise<void>;
};

export function useAnomalyDetection(
  userId: string | undefined,
  options: UseAnomalyDetectionOptions = {}
): UseAnomalyDetectionReturn {
  const { autoLoad = true, cacheTimeout = 10, historyDays = 7 } = options;

  const [recentAnomalies, setRecentAnomalies] = useState<VitalAnomaly[]>([]);
  const [anomalyStats, setAnomalyStats] = useState<AnomalyStats | null>(null);
  const [baselineStatuses, setBaselineStatuses] = useState<BaselineStatus[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastLoadTimeRef = useRef<Date | null>(null);
  const hasLoadedRef = useRef(false);

  const isCacheValid = useCallback(() => {
    if (!lastLoadTimeRef.current) return false;
    const diffMinutes =
      (Date.now() - lastLoadTimeRef.current.getTime()) / (1000 * 60);
    return diffMinutes < cacheTimeout;
  }, [cacheTimeout]);

  const loadData = useCallback(
    async (force = false) => {
      if (!userId) return;
      if (!force && isCacheValid() && hasLoadedRef.current) return;

      try {
        setLoading(true);
        setError(null);

        const [anomalies, stats] = await Promise.all([
          anomalyDetectionService.getAnomalyHistory(
            userId,
            undefined,
            historyDays
          ),
          anomalyDetectionService.getAnomalyStats(userId),
        ]);

        setRecentAnomalies(anomalies);
        setAnomalyStats(stats);
        lastLoadTimeRef.current = new Date();
        hasLoadedRef.current = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load anomaly data"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, historyDays, isCacheValid]
  );

  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  const acknowledge = useCallback(
    async (anomalyId: string) => {
      if (!userId) return;
      await anomalyDetectionService.acknowledgeAnomaly(userId, anomalyId);
      setRecentAnomalies((prev) =>
        prev.map((a) => (a.id === anomalyId ? { ...a, acknowledged: true } : a))
      );
    },
    [userId]
  );

  const ensureBaselines = useCallback(async () => {
    if (!userId) return;
    try {
      const statuses =
        await anomalyDetectionService.ensureBaselinesExist(userId);
      setBaselineStatuses(statuses);
    } catch {
      // Silently fail
    }
  }, [userId]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && userId) {
      loadData();
    }
  }, [autoLoad, userId, loadData]);

  return {
    recentAnomalies,
    anomalyStats,
    baselineStatuses,
    loading,
    error,
    refresh,
    acknowledge,
    ensureBaselines,
  };
}
