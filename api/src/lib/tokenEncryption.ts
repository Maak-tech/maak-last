/**
 * AES-256-GCM token encryption for sensitive credentials stored in Neon JSONB.
 *
 * Encryption key is loaded from TOKEN_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * Generate with: openssl rand -hex 32
 *
 * Format stored: base64(iv[16] + authTag[16] + ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const HEX_KEY = process.env.TOKEN_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!HEX_KEY || HEX_KEY.length !== 64) {
    // Fail closed — never silently use a weak fallback in production
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be set as a 64-char hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(HEX_KEY, "hex");
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64-encoded blob: iv(16) + authTag(16) + ciphertext.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a value produced by encryptToken().
 * Throws if the ciphertext is tampered with (GCM auth tag mismatch).
 */
export function decryptToken(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const ciphertext = buf.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * True if TOKEN_ENCRYPTION_KEY is configured and valid length.
 * Use to emit a startup warning if missing.
 */
export const isEncryptionConfigured = (): boolean =>
  typeof HEX_KEY === "string" && HEX_KEY.length === 64;
