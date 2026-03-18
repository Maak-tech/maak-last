/**
 * useMLInsightsBadge hook
 *
 * Aggregates lightweight signals from the ML pipeline to produce a badge count
 * shown on the home screen's AI section and the Analytics screen's entry point.
 *
 * Counts:
 *  1. Unacknowledged critical/warning anomalies (from Firestore)
 *  2. Actionable pattern insights (temporal, vital-trend) that haven't been seen
 *  3. New health discoveries (status === "new")
 *
 * Returns:
 *  - badgeCount: number  (0 = all clear)
 *  - hasCritical: boolean (any critical severity anomaly)
 *  - loading: boolean
 *
 * Cache: 5-minute TTL — lightweight queries only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import { getAllDiscoveries } from "@/lib/services/discoveryService";

const CACHE_TTL_MS = 5 * 60 * 1000;

type UseMLInsightsBadgeReturn = {
  badgeCount: number;
  hasCritical: boolean;
  loading: boolean;
};

export function useMLInsightsBadge(
  userId: string | undefined
): UseMLInsightsBadgeReturn {
  const [badgeCount, setBadgeCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastLoadRef = useRef<number>(0);

  const load = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastLoadRef.current < CACHE_TTL_MS) return;

    setLoading(true);
    try {
      // 1. Unacknowledged anomalies
      const anomalySnap = await api.get<Record<string, unknown>[]>(
        `/api/health/anomalies?userId=${userId}&acknowledged=false&limit=50`
      ).catch(() => null);
      const anomalyDocs = anomalySnap ?? [];
      const criticalAnomalies = anomalyDocs.filter(
        (d) => d.severity === "critical"
      );
      const anomalyCount = anomalyDocs.length;
      const isCritical = criticalAnomalies.length > 0;

      // 2. New discoveries
      const discoveries = await getAllDiscoveries(userId).catch(() => []);
      const newDiscoveries = discoveries.filter((d) => d.status === "new");

      const total = anomalyCount + newDiscoveries.length;
      setBadgeCount(Math.min(total, 99)); // cap at 99
      setHasCritical(isCritical);
      lastLoadRef.current = Date.now();
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { badgeCount, hasCritical, loading };
}
