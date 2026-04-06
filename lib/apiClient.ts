/**
 * Nuralix API client.
 * Thin fetch wrapper that:
 *   - Automatically prepends EXPO_PUBLIC_API_URL
 *   - Attaches the Better-auth session cookie/header
 *   - Throws on non-2xx responses with a readable error message
 */

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Optional global 401 handler — set by AuthContext to trigger logout when
// the session expires mid-use. Without this, stale sessions cause silent API
// failures that leave the user stuck on a broken screen.
let _onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  _onUnauthorized = handler;
}

// Dedup flag — prevents multiple concurrent 401 responses from each firing
// their own logout (e.g. when several in-flight requests all expire at once).
let _handlingUnauthorized = false;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Default timeout for all API calls. Prevents requests from hanging indefinitely
// when the server is unreachable or a Railway service restarts mid-request.
const DEFAULT_TIMEOUT_MS = 30_000;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include", // sends Better-auth session cookie
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      // Response body is not JSON (e.g. plain-text error from a proxy/CDN) — ignore parse error
    }
    const message =
      (errorBody as { error?: string })?.error ??
      `Request failed: ${res.status} ${res.statusText}`;

    // Trigger global logout handler on 401 so the app navigates to the login
    // screen instead of silently failing with a broken UI.
    // The _handlingUnauthorized flag deduplicates concurrent 401 responses so
    // only one logout fires when multiple in-flight requests all expire at once.
    if (res.status === 401 && _onUnauthorized && !_handlingUnauthorized) {
      _handlingUnauthorized = true;
      // Small delay to let any in-flight requests see the flag before we clear it
      setTimeout(() => {
        try {
          _onUnauthorized?.();
        } finally {
          _handlingUnauthorized = false;
        }
      }, 50);
    }

    throw new ApiError(message, res.status, errorBody);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>("GET", path, undefined, headers),
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>("POST", path, body, headers),
  put: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>("PUT", path, body, headers),
  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>("PATCH", path, body, headers),
  delete: <T>(path: string, headers?: Record<string, string>) =>
    request<T>("DELETE", path, undefined, headers),
};
