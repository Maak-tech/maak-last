/**
 * WebSocket wrapper with header support for React Native
 *
 * Uses react-native-websocket library for better header support across platforms.
 * Falls back to native WebSocket if the library is not available.
 */

import { Platform } from "react-native";

// Try to use react-native-websocket for better header support
let RNWebSocket: any = null;
try {
  RNWebSocket = require("react-native-websocket").default;
} catch {
  // react-native-websocket not available, will use fallback
}

export interface WebSocketWithHeadersOptions {
  headers?: Record<string, string>;
}

/**
 * Create a WebSocket connection with custom headers
 *
 * Uses react-native-websocket library when available for better header support.
 * Falls back to native WebSocket implementation.
 *
 * @param url - WebSocket URL
 * @param protocols - Optional protocols
 * @param options - Options including headers
 * @returns WebSocket instance
 */
export function createWebSocketWithHeaders(
  url: string,
  protocols?: string | string[],
  options?: WebSocketWithHeadersOptions
): WebSocket {
  const headers = options?.headers || {};

  try {
    // Try using react-native-websocket first (better header support)
    if (RNWebSocket && (Platform.OS === "ios" || Platform.OS === "android")) {
      const wsOptions: any = {
        headers,
        origin: "https://api.openai.com", // Required for some WebSocket implementations
      };

      const ws = new RNWebSocket(url, protocols, wsOptions);
      return ws;
    }

    // Fallback to native WebSocket with headers in options
    const wsOptions: any = {};

    if (Object.keys(headers).length > 0) {
      wsOptions.headers = headers;
    }

    // Create WebSocket with options
    const ws = new WebSocket(url, protocols, wsOptions);
    return ws;
  } catch (error) {
    // Last resort fallback without headers
    return new WebSocket(url, protocols);
  }
}

/**
 * Check if WebSocket headers are supported on this platform
 */
export function isWebSocketHeadersSupported(): boolean {
  // Headers are generally supported on React Native 0.62+
  // But iOS and Android have better support than web
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return true;
  }

  // Web platform doesn't support WebSocket headers for security reasons
  if (Platform.OS === "web") {
    return false;
  }

  return false;
}

/**
 * Get platform-specific guidance for WebSocket issues
 */
export function getWebSocketSetupGuidance(): string {
  if (Platform.OS === "web") {
    return "WebSocket authentication headers are not supported on web. Consider using a proxy server or alternative authentication method.";
  }

  if (Platform.OS === "ios" || Platform.OS === "android") {
    return "Ensure you are using React Native 0.62+ for WebSocket header support. If issues persist, try rebuilding the app.";
  }

  return "WebSocket header support may be limited on this platform.";
}
