/**
 * Unit tests for hospital server encryption primitives.
 *
 * Tests run fully offline — no DB, no network.
 * All functions are pure (AES-256-GCM via Node.js crypto).
 */
import { describe, it, expect, beforeAll } from 'vitest'

// Set the env var before the module is loaded.
// 32-byte hex = 64 hex characters (256-bit AES key).
const TEST_KEY = 'a'.repeat(64)
process.env.DB_ENCRYPTION_KEY = TEST_KEY

import { encrypt, decrypt, hmac } from '../lib/encryption.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomAlpha(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('encrypt / decrypt', () => {
  it('roundtrip: decrypt(encrypt(x)) === x for a simple string', () => {
    const plain = 'hello-world'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('roundtrip: preserves a UUID-shaped subject ID', () => {
    const uuid = '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47'
    expect(decrypt(encrypt(uuid))).toBe(uuid)
  })

  it('roundtrip: preserves an RTSP URL containing credentials', () => {
    const rtsp = 'rtsp://admin:P@ssw0rd!@192.168.1.50:554/stream1'
    expect(decrypt(encrypt(rtsp))).toBe(rtsp)
  })

  it('each call to encrypt produces a different ciphertext (random IV)', () => {
    const plain = 'same-plaintext'
    const c1 = encrypt(plain)
    const c2 = encrypt(plain)
    expect(c1).not.toBe(c2)
  })

  it('ciphertext format: iv(32) + tag(32) + body (all hex)', () => {
    const ciphertext = encrypt('test')
    // Minimum length: 64 hex (iv + tag) + at least 2 hex chars of body
    expect(ciphertext.length).toBeGreaterThanOrEqual(66)
    // Must be valid hex
    expect(/^[0-9a-f]+$/.test(ciphertext)).toBe(true)
    // Must be even-length hex
    expect(ciphertext.length % 2).toBe(0)
  })

  it('decrypt throws on corrupted ciphertext (GCM auth tag mismatch)', () => {
    const ciphertext = encrypt('sensitive-data')
    // Flip the last hex character to corrupt the GCM auth tag or ciphertext body
    const corrupted = ciphertext.slice(0, -1) + (ciphertext.endsWith('f') ? '0' : 'f')
    expect(() => decrypt(corrupted)).toThrow()
  })

  it('decrypt throws on a string that is too short to be valid ciphertext', () => {
    expect(() => decrypt('deadbeef')).toThrow('Invalid encrypted data format')
  })

  it('decrypt on an empty string returns the empty string (guard branch)', () => {
    // The guard `if (!stored) return stored` handles empty strings without throwing.
    expect(decrypt('')).toBe('')
  })

  it('roundtrip is stable for 100 random strings', () => {
    for (let i = 0; i < 100; i++) {
      const plain = randomAlpha(Math.floor(Math.random() * 80) + 1)
      expect(decrypt(encrypt(plain))).toBe(plain)
    }
  })
})

describe('hmac', () => {
  it('is deterministic: same input → same output', () => {
    const input = 'subject-id-abc123'
    expect(hmac(input)).toBe(hmac(input))
  })

  it('produces a 64-char hex string (SHA-256 = 32 bytes = 64 hex)', () => {
    const h = hmac('test')
    expect(h).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(h)).toBe(true)
  })

  it('different inputs → different HMACs', () => {
    expect(hmac('subject-a')).not.toBe(hmac('subject-b'))
  })

  it('hmac output is consistent with encrypt/decrypt subject IDs (can be used as lookup key)', () => {
    const subjectId = '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47'
    const encrypted = encrypt(subjectId)
    const h = hmac(subjectId)

    // The stored HMAC lets us look up a row by subjectId without decrypting every row.
    // Verify: hmac(decrypted) equals the stored hmac.
    expect(hmac(decrypt(encrypted))).toBe(h)
  })
})
