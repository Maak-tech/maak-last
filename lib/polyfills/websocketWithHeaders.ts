/**
 * WebSocket with Headers polyfill.
 *
 * The browser WebSocket API does not support custom headers. This module
 * provides a workaround for the OpenAI Realtime API which requires an
 * Authorization header on the WebSocket upgrade request.
 *
 * On React Native, we use a native WebSocket implementation that supports
 * the headers option in the constructor (available in RN 0.60+).
 * On web, we fall back to a query-parameter-based token approach.
 */

import { Platform } from "react-native";

export interface WebSocketWithHeadersOptions {
  headers?: Record<string, string>;
  protocols?: string | string[];
}

/**
 * Create a WebSocket connection with custom headers.
 *
 * On React Native: passes headers as the 4th argument to the WebSocket
 * constructor (supported by the native implementation).
 *
 * On web: headers cannot be sent on WebSocket upgrade. Instead, the
 * Authorization token is appended as a query parameter. The server must
 * accept `?token=` as an alternative to the Authorization header.
 */
export function createWebSocketWithHeaders(
  url: string,
  options: WebSocketWithHeadersOptions = {}
): WebSocket {
  const { headers = {}, protocols } = options;

  if (Platform.OS === "web") {
    // Web: inject auth token as query param (server must support this)
    const authHeader = headers["Authorization"] ?? headers["authorization"] ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const urlWithToken = token
      ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
      : url;
    return new WebSocket(urlWithToken, protocols);
  }

  // React Native: native WebSocket supports headers as 4th constructor arg
  // The type definition doesn't include it, so we cast to any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (WebSocket as any)(url, protocols ?? null, null, headers) as WebSocket;
}

/**
 * Returns a human-readable guidance string explaining how to set up
 * WebSocket connections with auth headers in the current environment.
 * Used for debugging connection issues.
 */
export function getWebSocketSetupGuidance(): string {
  if (Platform.OS === "web") {
    return (
      "Web platform: WebSocket headers are not supported by browsers. " +
      "The Authorization token is appended as ?token= query parameter. " +
      "Ensure the server accepts token-based auth on the WebSocket endpoint."
    );
  }

  return (
    "React Native: WebSocket headers are passed via the native constructor. " +
    "Requires React Native 0.60+ with the Hermes engine or JavaScriptCore. " +
    "Headers are sent on the HTTP upgrade request."
  );
}
