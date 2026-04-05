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
  onTrendAlert,
  onFamilyMemberUpdate,
  onAlertCreated,
  onAlertResolved,
  onError,
  enabled = true,
}: UseRealtimeHealthOptions): void {
  const vhiWsRef = useRef<WebSocket | null>(null);
  const familyWsRef = useRef<WebSocket | null>(null);
  const reconnectVhiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectFamilyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── VHI + alert stream: /ws/vhi/:userId ──────────────────────────────────────
  const connectVhi = useCallback(() => {
    if (!userId || !mountedRef.current || !enabled) return;
    try {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/vhi/${userId}`);
      vhiWsRef.current = ws;

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as { event: string; data: unknown };
          switch (msg.event) {
            case "trend_alert":
              onTrendAlert?.(msg.data as TrendAlert);
              break;
            case "alert_created":
              onAlertCreated?.(msg.data as EmergencyAlert);
              break;
            case "alert_resolved": {
              const d = msg.data as { alertId?: string; resolverId?: string };
              if (d?.alertId && d?.resolverId) onAlertResolved?.(d.alertId, d.resolverId);
              break;
            }
          }
        } catch (parseErr) {
          console.debug('[useRealtimeHealth] VHI message parse failed:', parseErr instanceof Error ? parseErr.message : String(parseErr));
        }
      };

      ws.onerror = () => {
        onError?.(new Error("VHI WebSocket error"));
        ws.close();
      };

      ws.onclose = () => {
        vhiWsRef.current = null;
        if (mountedRef.current) {
          reconnectVhiTimer.current = setTimeout(connectVhi, 5_000);
        }
      };
    } catch (err: unknown) {
      console.debug('[useRealtimeHealth] VHI WebSocket connection failed:', err instanceof Error ? err.message : String(err));
    }
  }, [userId, enabled, onTrendAlert, onAlertCreated, onAlertResolved, onError]);

  // ── Family stream: /ws/family/:familyId ──────────────────────────────────────
  const connectFamily = useCallback(() => {
    if (!familyId || !mountedRef.current || !enabled) return;
    try {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/family/${familyId}`);
      familyWsRef.current = ws;

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as { event: string; data: unknown };
          if (msg.event === "family_member_update") {
            onFamilyMemberUpdate?.(msg.data as FamilyMemberUpdate);
          }
        } catch (parseErr) {
          console.debug('[useRealtimeHealth] Family message parse failed:', parseErr instanceof Error ? parseErr.message : String(parseErr));
        }
      };

      ws.onerror = () => {
        onError?.(new Error("Family WebSocket error"));
        ws.close();
      };

      ws.onclose = () => {
        familyWsRef.current = null;
        if (mountedRef.current) {
          reconnectFamilyTimer.current = setTimeout(connectFamily, 5_000);
        }
      };
    } catch (err: unknown) {
      console.debug('[useRealtimeHealth] Family WebSocket connection failed:', err instanceof Error ? err.message : String(err));
    }
  }, [familyId, enabled, onFamilyMemberUpdate, onError]);

  useEffect(() => {
    mountedRef.current = true;
    connectVhi();
    connectFamily();
    return () => {
      mountedRef.current = false;
      if (reconnectVhiTimer.current) clearTimeout(reconnectVhiTimer.current);
      if (reconnectFamilyTimer.current) clearTimeout(reconnectFamilyTimer.current);
      vhiWsRef.current?.close();
      familyWsRef.current?.close();
      vhiWsRef.current = null;
      familyWsRef.current = null;
    };
  }, [connectVhi, connectFamily]);
}
