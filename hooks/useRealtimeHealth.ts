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

export interface UseRealtimeHealthOptions {
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
}

export interface UseRealtimeHealthReturn {
  isConnected: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
}

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

  const subscribe = useCallback(() => {
    if (!enabled || isConnectedRef.current) {
      return;
    }

    const unsubscribes: Array<() => void> = [];

    // Set up event handlers
    const handlers: RealtimeHealthEventHandlers = {
      onTrendAlert,
      onFamilyMemberUpdate,
      onAlertCreated,
      onAlertResolved,
      onVitalAdded,
      onError,
    };
    realtimeHealthService.setEventHandlers(handlers);

    // Subscribe to trend alerts for the user
    if (userId) {
      const unsubscribeTrendAlerts =
        realtimeHealthService.subscribeToTrendAlerts(userId, onTrendAlert);
      unsubscribes.push(unsubscribeTrendAlerts);

      // Subscribe to user alerts
      const unsubscribeUserAlerts = realtimeHealthService.subscribeToUserAlerts(
        userId,
        onAlertCreated,
        onAlertResolved
      );
      unsubscribes.push(unsubscribeUserAlerts);

      // Subscribe to user vitals
      const unsubscribeUserVitals = realtimeHealthService.subscribeToUserVitals(
        userId,
        onVitalAdded
      );
      unsubscribes.push(unsubscribeUserVitals);
    }

    // Subscribe to family member updates
    if (familyId && familyMemberIds.length > 0) {
      const unsubscribeFamilyUpdates =
        realtimeHealthService.subscribeToFamilyMemberUpdates(
          familyId,
          familyMemberIds,
          onFamilyMemberUpdate
        );
      unsubscribes.push(unsubscribeFamilyUpdates);
    }

    unsubscribeRefs.current = unsubscribes;
    isConnectedRef.current = true;
  }, [
    enabled,
    userId,
    familyId,
    familyMemberIds.join(","),
    onTrendAlert,
    onFamilyMemberUpdate,
    onAlertCreated,
    onAlertResolved,
    onVitalAdded,
    onError,
  ]);

  const unsubscribe = useCallback(() => {
    unsubscribeRefs.current.forEach((unsub) => unsub());
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
