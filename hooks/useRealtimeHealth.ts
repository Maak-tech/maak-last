/**
 * useRealtimeHealth — manages a WebSocket connection to the Nuralix API
 * for live health event streaming.
 *
 * Replaces the Firebase `onSnapshot` pattern for VHI, family member updates,
 * trend alerts, and emergency alerts.
 */

import { useCallback, useEffect, useRef } from "react";
import type { FamilyMemberUpdate, TrendAlert } from "@/lib/services/realtimeHealthService";
import type { EmergencyAlert } from "@/types";

const WS_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000")
  .replace(/^http/, "ws");

interface UseRealtimeHealthOptions {
  userId?: string;
  familyId?: string;
  familyMemberIds?: string[];
  onTrendAlert?: (alert: TrendAlert) => void;
  onFamilyMemberUpdate?: (update: FamilyMemberUpdate) => void;
  onAlertCreated?: (alert: EmergencyAlert) => void;
  onAlertResolved?: (alertId: string, resolverId: string) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

export function useRealtimeHealth({
  userId,
  familyId,
  familyMemberIds,
  onTrendAlert,
  onFamilyMemberUpdate,
  onAlertCreated,
  onAlertResolved: _onAlertResolved,
  onError: _onError,
  enabled: _enabled,
}: UseRealtimeHealthOptions): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!userId || !mountedRef.current) return;

    try {
      const url = `${WS_BASE_URL}/ws/health/${userId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        // Subscribe to family channels if needed
        if (familyId) {
          ws.send(JSON.stringify({ type: "subscribe_family", familyId }));
        }
        if (familyMemberIds?.length) {
          ws.send(JSON.stringify({ type: "subscribe_members", memberIds: familyMemberIds }));
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: unknown;
          };

          switch (msg.type) {
            case "trend_alert":
              onTrendAlert?.(msg.payload as TrendAlert);
              break;
            case "family_member_update":
              onFamilyMemberUpdate?.(msg.payload as FamilyMemberUpdate);
              break;
            case "alert_created":
              onAlertCreated?.(msg.payload as EmergencyAlert);
              break;
          }
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) {
          // Reconnect after 5 seconds
          reconnectTimer.current = setTimeout(connect, 5_000);
        }
      };
    } catch {
      // WebSocket not available (web without SSL, tests, etc.)
    }
  }, [userId, familyId, familyMemberIds, onTrendAlert, onFamilyMemberUpdate, onAlertCreated]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
