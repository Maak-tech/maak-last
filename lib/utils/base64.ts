/**
 * Base64 helpers that work in React Native even when `atob` / `btoa` are missing.
 *
 * We implement small, dependency-free encode/decode for Uint8Array.
 */

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function getAtob(): ((b64: string) => string) | null {
  const fn = (globalThis as any)?.atob;
  return typeof fn === "function" ? fn : null;
}

function getBtoa(): ((bin: string) => string) | null {
  const fn = (globalThis as any)?.btoa;
  return typeof fn === "function" ? fn : null;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  // Fast path if atob exists
  const atobFn = getAtob();
  if (atobFn) {
    const binaryString = atobFn(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Remove whitespace and padding
  const clean = base64.replace(/\s+/g, "").replace(/=+$/g, "");
  if (clean.length === 0) return new Uint8Array(0);

  // Build reverse lookup table
  const rev = new Int16Array(256).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    rev[BASE64_ALPHABET.charCodeAt(i)] = i;
  }

  const outputLength = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outputLength);

  let outIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    const v = rev[c];
    if (v === -1) continue; // ignore non-base64 chars
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }

  return outIndex === out.length ? out : out.slice(0, outIndex);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Fast path if btoa exists
  const btoaFn = getBtoa();
  if (btoaFn) {
    let binary = "";
    // Chunk to avoid call stack / memory issues for larger arrays
    const chunkSize = 0x80_00;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...Array.from(chunk));
    }
    return btoaFn(binary);
  }

  let output = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    output += BASE64_ALPHABET[(n >> 18) & 63];
    output += BASE64_ALPHABET[(n >> 12) & 63];
    output += BASE64_ALPHABET[(n >> 6) & 63];
    output += BASE64_ALPHABET[n & 63];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    output += BASE64_ALPHABET[(n >> 18) & 63];
    output += BASE64_ALPHABET[(n >> 12) & 63];
    output += "==";
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    output += BASE64_ALPHABET[(n >> 18) & 63];
    output += BASE64_ALPHABET[(n >> 12) & 63];
    output += BASE64_ALPHABET[(n >> 6) & 63];
    output += "=";
  }

  return output;
}
