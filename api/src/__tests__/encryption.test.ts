/**
 * AES-256-GCM encryption round-trip tests.
 *
 * These tests verify the encryption scheme used by the hospital dashboard
 * server to store camera stream credentials. The algorithm is tested directly
 * here (no DB / network required) to confirm the encrypt → store → decrypt
 * cycle always produces the original plaintext.
 *
 * Format: iv (16 bytes) + authTag (16 bytes) + ciphertext — all hex-encoded
 * and concatenated as a single string.
 */
import { describe, it, expect } from 'bun:test';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns hex: iv (32 chars) + tag (32 chars) + ciphertext (variable).
 */
function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

/**
 * Decrypt a value produced by encrypt().
 */
function decrypt(key: Buffer, stored: string): string {
  const iv = Buffer.from(stored.slice(0, 32), 'hex');
  const tag = Buffer.from(stored.slice(32, 64), 'hex');
  const enc = Buffer.from(stored.slice(64), 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

describe('AES-256-GCM encryption', () => {
  it('encrypt/decrypt round-trip produces original plaintext', () => {
    const key = randomBytes(32);
    const plaintext = 'rtsp://user:pass@192.168.1.50/stream';
    expect(decrypt(key, encrypt(key, plaintext))).toBe(plaintext);
  });

  it('round-trip works for arbitrary UTF-8 strings', () => {
    const key = randomBytes(32);
    const samples = [
      'simple string',
      'rtsp://admin:S3cr3t!@10.0.0.5:554/live/stream1',
      JSON.stringify({ host: '192.168.1.1', port: 554, user: 'admin' }),
      'unicode: café résumé naïve 日本語',
    ];
    for (const s of samples) {
      expect(decrypt(key, encrypt(key, s))).toBe(s);
    }
  });

  it('different keys produce different ciphertexts', () => {
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);
    const plaintext = 'rtsp://user:pass@192.168.1.50/stream';
    const ct1 = encrypt(key1, plaintext);
    const ct2 = encrypt(key2, plaintext);
    // Ciphertexts differ (extremely high probability given random IV + key)
    expect(ct1).not.toBe(ct2);
  });

  it('tampered ciphertext throws on decryption (auth tag mismatch)', () => {
    const key = randomBytes(32);
    const stored = encrypt(key, 'sensitive data');
    // Flip the last byte of the ciphertext hex
    const lastHex = stored.slice(-2);
    const flipped = ((parseInt(lastHex, 16) + 1) % 256).toString(16).padStart(2, '0');
    const tampered = stored.slice(0, -2) + flipped;
    expect(() => decrypt(key, tampered)).toThrow();
  });
});
