import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.DB_ENCRYPTION_KEY
  if (!hex) throw new Error('DB_ENCRYPTION_KEY is not set')
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex')
}

/**
 * HMAC-SHA256 of plaintext using the DB encryption key.
 * Deterministic (no IV) — used as a fast lookup index for encrypted values.
 * Stored alongside the encrypted ciphertext in biometric_enrollments so
 * recognize.ts can do a direct O(1) DB lookup instead of a full-table decrypt scan.
 */
export function hmac(plaintext: string): string {
  const key = getKey()
  return createHmac('sha256', key).update(plaintext).digest('hex')
}

export function decrypt(stored: string): string {
  if (!stored) return stored
  // iv (16 bytes = 32 hex) + tag (16 bytes = 32 hex) = 64 hex chars minimum
  if (stored.length < 65 || stored.length % 2 !== 0) {
    throw new Error('Invalid encrypted data format: too short or odd-length hex string')
  }
  try {
    const key = getKey()
    const iv = Buffer.from(stored.slice(0, 32), 'hex')
    const tag = Buffer.from(stored.slice(32, 64), 'hex')
    const encrypted = Buffer.from(stored.slice(64), 'hex')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
  } catch (err: unknown) {
    throw new Error(`Decryption failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
