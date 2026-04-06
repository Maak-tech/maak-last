/**
 * useVHISocket — real-time VHI update subscription.
 *
 * Connects to the Nuralix WebSocket endpoint `/ws/vhi/:userId` and delivers
 * `vhi.updated` events so the VHI panel reflects the latest computed health
 * identity without requiring a manual refresh or polling interval.
 *
 * Auth:
 *   - React Native: passes the better-auth session token as an Authorization
 *     Bearer header (via the createWebSocketWithHeaders polyfill).  The token
 *     is read from expo-secure-store using the key the @better-auth/expo client
 *     writes when the user signs in.
 *   - Web: appends the token as a `?token=` query param (browsers cannot set
 *     headers on WebSocket upgrade requests).
 *
 * Reconnection:
 *   Exponential back-off starting at 2 s, capped at 30 s.  The hook stops
 *   retrying after `maxRetries` consecutive failures (default 8 ≈ ~4 minutes).
 *   All reconnect timers are cleared on unmount / when userId changes.
 *
 * Usage:
 *   const { isConnected, lastEvent } = useVHISocket(userId, {
 *     onVHIUpdate: (payload) => setVHI(prev => ({ ...prev, ...payload })),
 *   })
 */

import { useEffect, useRef, useCallback, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { createWebSocketWithHeaders } from "../polyfills/websocketWithHeaders";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VHIUpdatePayload {
  overallScore: number;
  compositeRisk: number;
  riskLevel: "low" | "moderate" | "high";
  trajectory: "worsening" | "stable" | "improving" | "insufficient";
  updatedAt: string;
}

interface ServerMessage {
  event: string;
  data?: unknown;
  timestamp?: string;
  userId?: string;
}

export interface UseVHISocketOptions {
  /** Called when the server broadcasts a `vhi.updated` event. */
  onVHIUpdate?: (payload: VHIUpdatePayload) => void;
  /** Called when the WebSocket connects successfully. */
  onConnect?: () => void;
  /** Called when the WebSocket disconnects (all retries exhausted or userId cleared). */
  onDisconnect?: () => void;
  /** Maximum consecutive reconnect attempts before giving up. Default: 8. */
  maxRetries?: number;
  /** Disable the socket without changing userId. Useful for backgrounded screens. */
  enabled?: boolean;
}

export interface UseVHISocketResult {
  /** True while the WebSocket handshake is complete and the connection is open. */
  isConnected: boolean;
  /** The most recent parsed message from the server. */
  lastEvent: ServerMessage | null;
  /** Manually trigger a reconnect (e.g., after the app comes back to the foreground). */
  reconnect: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

// The @better-auth/expo client stores the session cookie/token in SecureStore
// under this key (storagePrefix = "nuralix" set in lib/authClient.ts).
const SESSION_TOKEN_KEY = "nuralix_session_token";

const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVHISocket(
  userId: string | null | undefined,
  options: UseVHISocketOptions = {}
): UseVHISocketResult {
  const {
    onVHIUpdate,
    onConnect,
    onDisconnect,
    maxRetries = 8,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ServerMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const backoffMsRef = useRef(INITIAL_BACKOFF_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Stable callback refs so the WS handlers don't capture stale closures
  const onVHIUpdateRef = useRef(onVHIUpdate);
  onVHIUpdateRef.current = onVHIUpdate;
  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      // Remove event handlers first to prevent onclose firing the reconnect path
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close(1000, "unmount");
      } catch {
        // Already closed — ignore
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current || !userId || !enabled) return;

    closeSocket();
    clearRetryTimer();

    // Build the WebSocket URL (ws:// or wss:// based on API URL)
    const wsBase = BASE_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/ws/vhi/${userId}`;

    // Fetch session token for explicit auth header (React Native) / ?token= (web)
    let sessionToken: string | null = null;
    try {
      sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    } catch {
      // SecureStore unavailable (e.g., simulator with no keychain) — attempt without token.
      // The server will try cookie-based auth as a fallback.
    }

    const ws = createWebSocketWithHeaders(wsUrl, {
      headers: sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {},
    });

    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      retryCountRef.current = 0;
      backoffMsRef.current = INITIAL_BACKOFF_MS;
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(
          typeof event.data === "string" ? event.data : String(event.data)
        ) as ServerMessage;

        setLastEvent(msg);

        if (msg.event === "vhi.updated" && msg.data) {
          onVHIUpdateRef.current?.(msg.data as VHIUpdatePayload);
        }

        // Server pings — respond to keep connection alive through proxies/load balancers
        if (msg.event === "ping") {
          ws.send("pong");
        }
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onerror = () => {
      // onerror always precedes onclose; let onclose handle reconnect logic
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      setIsConnected(false);

      // 1008 = Policy Violation (unauthorized) — do NOT retry, would keep failing
      if (event.code === 1008) {
        onDisconnectRef.current?.();
        return;
      }

      // 1000 = Normal closure (intentional unmount / logout) — do NOT retry
      if (event.code === 1000) {
        onDisconnectRef.current?.();
        return;
      }

      if (retryCountRef.current >= maxRetries) {
        onDisconnectRef.current?.();
        return;
      }

      retryCountRef.current += 1;
      const delay = backoffMsRef.current;
      backoffMsRef.current = Math.min(
        backoffMsRef.current * BACKOFF_MULTIPLIER,
        MAX_BACKOFF_MS
      );

      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [userId, enabled, closeSocket, clearRetryTimer, maxRetries]);

  // Connect / disconnect when userId or enabled changes
  useEffect(() => {
    mountedRef.current = true;
    retryCountRef.current = 0;
    backoffMsRef.current = INITIAL_BACKOFF_MS;

    if (userId && enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearRetryTimer();
      closeSocket();
    };
  }, [userId, enabled, connect, clearRetryTimer, closeSocket]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    backoffMsRef.current = INITIAL_BACKOFF_MS;
    connect();
  }, [connect]);

  return { isConnected, lastEvent, reconnect };
}
