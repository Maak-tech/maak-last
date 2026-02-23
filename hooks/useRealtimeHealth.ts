/**
 * Hook for subscribing to real-time health updates
 * Handles trend alerts and family member updates via WebSocket-like Firestore listeners
 */

import { useCallback, useEffect, useRef } from "react";
import {
  type FamilyMemberUpdate,
  type RealtimeHealthEventHandlers,
  realtimeHealthService,
  type TrendAlert,
} from "@/lib/services/realtimeHealthService";
import type { EmergencyAlert } from "@/types";

export type UseRealtimeHealthOptions = {
  userId?: string;
  familyId?: string;
  familyMemberIds?: string[];
  onTrendAlert?: (alert: TrendAlert) => void;
  onFamilyMemberUpdate?: (update: FamilyMemberUpdate) => void;
  onAlertCreated?: (alert: EmergencyAlert) => void;
  onAlertResolved?: (alertId: string, resolverId: string) => void;
  onVitalAdded?: (vital: {
    userId: string;
    type: string;
    value: number;
    timestamp: Date;
  }) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
};

export type UseRealtimeHealthReturn = {
  isConnected: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
};

/**
 * Hook to subscribe to real-time health updates
 * Automatically manages subscriptions and cleanup
 */
export function useRealtimeHealth(
  options: UseRealtimeHealthOptions = {}
): UseRealtimeHealthReturn {
  const {
    userId,
    familyId,
    familyMemberIds = [],
    onTrendAlert,
    onFamilyMemberUpdate,
    onAlertCreated,
    onAlertResolved,
    onVitalAdded,
    onError,
    enabled = true,
  } = options;

  const isConnectedRef = useRef(false);
  const unsubscribeRefs = useRef<Array<() => void>>([]);

  // Keep latest callbacks in a ref so subscribe/unsubscribe don't need to
  // re-run when only a callback identity changes (avoids listener churn).
  const handlersRef = useRef<RealtimeHealthEventHandlers>({});
  handlersRef.current = {
    onTrendAlert,
    onFamilyMemberUpdate,
    onAlertCreated,
    onAlertResolved,
    onVitalAdded,
    onError,
  };

  const subscribe = useCallback(() => {
    if (!enabled || isConnectedRef.current) {
      return;
    }

    const unsubscribes: Array<() => void> = [];

    // Route all events through the stable ref so the service always calls
    // the latest handler without needing to re-subscribe.
    const stableHandlers: RealtimeHealthEventHandlers = {
      onTrendAlert: (...args) => handlersRef.current.onTrendAlert?.(...args),
      onFamilyMemberUpdate: (...args) => handlersRef.current.onFamilyMemberUpdate?.(...args),
      onAlertCreated: (...args) => handlersRef.current.onAlertCreated?.(...args),
      onAlertResolved: (...args) => handlersRef.current.onAlertResolved?.(...args),
      onVitalAdded: (...args) => handlersRef.current.onVitalAdded?.(...args),
      onError: (...args) => handlersRef.current.onError?.(...args),
    };
    realtimeHealthService.setEventHandlers(stableHandlers);

    // Subscribe to trend alerts for the user
    if (userId) {
      const unsubscribeTrendAlerts =
        realtimeHealthService.subscribeToTrendAlerts(userId, stableHandlers.onTrendAlert);
      unsubscribes.push(unsubscribeTrendAlerts);

      // Subscribe to user alerts
      const unsubscribeUserAlerts = realtimeHealthService.subscribeToUserAlerts(
        userId,
        stableHandlers.onAlertCreated,
        stableHandlers.onAlertResolved
      );
      unsubscribes.push(unsubscribeUserAlerts);

      // Subscribe to user vitals
      const unsubscribeUserVitals = realtimeHealthService.subscribeToUserVitals(
        userId,
        stableHandlers.onVitalAdded
      );
      unsubscribes.push(unsubscribeUserVitals);
    }

    // Subscribe to family member updates
    if (familyId && familyMemberIds.length > 0) {
      const unsubscribeFamilyUpdates =
        realtimeHealthService.subscribeToFamilyMemberUpdates(
          familyId,
          familyMemberIds,
          stableHandlers.onFamilyMemberUpdate
        );
      unsubscribes.push(unsubscribeFamilyUpdates);
    }

    unsubscribeRefs.current = unsubscribes;
    isConnectedRef.current = true;
  }, [
    enabled,
    userId,
    familyId,
    familyMemberIds,
    // Callbacks intentionally excluded — accessed via handlersRef to prevent
    // listener churn when callback identities change without semantic change.
  ]);

  const unsubscribe = useCallback(() => {
    for (const unsub of unsubscribeRefs.current) {
      unsub();
    }
    unsubscribeRefs.current = [];
    isConnectedRef.current = false;
  }, []);

  // Auto-subscribe on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [enabled, subscribe, unsubscribe]);

  return {
    isConnected: isConnectedRef.current,
    subscribe,
    unsubscribe,
  };
}
