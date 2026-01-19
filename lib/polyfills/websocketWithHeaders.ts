/**
 * WebSocket wrapper with header support for React Native
 *
 * React Native's WebSocket doesn't reliably support headers across all platforms.
 * This wrapper provides a consistent interface for creating WebSocket connections
 * with authentication headers.
 *
 * Note: On React Native 0.60+, the third parameter should support headers,
 * but it requires the native side to be properly configured.
 */

import { Platform } from "react-native";

export interface WebSocketWithHeadersOptions {
  headers?: Record<string, string>;
}

/**
 * Create a WebSocket connection with custom headers
 *
 * For React Native, headers need to be passed in a specific way that
 * the native WebSocket implementation can understand.
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
    // For React Native, we need to pass headers in the options object
    // The native implementation should pick this up

    // Try the standard approach with headers
    // React Native 0.60+ should support this on native platforms
    const wsOptions: any = {};

    if (Object.keys(headers).length > 0) {
      wsOptions.headers = headers;
    }

    // Create WebSocket with options
    // Note: The third parameter is React Native specific and not part of web standards
    const ws = new WebSocket(url, protocols, wsOptions);

    return ws;
  } catch (error) {
    // Last resort fallback
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
