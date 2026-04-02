/**
 * Base64 utilities — encode/decode between Base64 strings and Uint8Array.
 *
 * Used by the realtime voice agent service to encode/decode PCM audio chunks
 * for transmission over the OpenAI Realtime API WebSocket.
 *
 * Implementation uses the built-in btoa/atob APIs available in React Native
 * (via JavaScriptCore) and falls back to a manual encode/decode when needed.
 */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Convert a Base64 string to a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Strip data URI prefix if present (e.g. "data:audio/pcm;base64,...")
  const stripped = base64.includes(",") ? base64.split(",")[1] : base64;

  try {
    const binary = atob(stripped);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    // atob not available — manual decode
    return manualBase64Decode(stripped);
  }
}

/**
 * Convert a Uint8Array to a Base64 string.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  try {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch {
    // btoa not available — manual encode
    return manualBase64Encode(bytes);
  }
}

/**
 * Encode a plain string to Base64.
 */
export function stringToBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    const encoder = new TextEncoder();
    return uint8ArrayToBase64(encoder.encode(str));
  }
}

/**
 * Decode a Base64 string to a plain string.
 */
export function base64ToString(base64: string): string {
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    const bytes = base64ToUint8Array(base64);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }
}

// ── Manual fallback implementations ───────────────────────────────────────────

function manualBase64Encode(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    result += CHARS[b0 >> 2];
    result += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < len ? CHARS[b2 & 63] : "=";
  }

  return result;
}

function manualBase64Decode(base64: string): Uint8Array {
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const c0 = CHARS.indexOf(padded[i]);
    const c1 = CHARS.indexOf(padded[i + 1]);
    const c2 = padded[i + 2] === "=" ? 0 : CHARS.indexOf(padded[i + 2]);
    const c3 = padded[i + 3] === "=" ? 0 : CHARS.indexOf(padded[i + 3]);

    bytes.push((c0 << 2) | (c1 >> 4));
    if (padded[i + 2] !== "=") bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (padded[i + 3] !== "=") bytes.push(((c2 & 3) << 6) | c3);
  }

  return new Uint8Array(bytes);
}
