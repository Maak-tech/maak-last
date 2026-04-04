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
  const key = getKey()
  const iv = Buffer.from(stored.slice(0, 32), 'hex')
  const tag = Buffer.from(stored.slice(32, 64), 'hex')
  const encrypted = Buffer.from(stored.slice(64), 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
