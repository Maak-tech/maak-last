import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY_HEX_LENGTH = 64 // 32 bytes = 256 bits

function getKey(): Buffer {
  const hex = process.env.FILE_ENCRYPTION_KEY
  if (!hex || hex.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `FILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ` +
      `Generate with: openssl rand -hex 32`,
    )
  }
  return Buffer.from(hex, 'hex')
}

export interface EncryptedFile {
  data: Buffer         // IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
  algorithm: 'aes-256-gcm'
  encoding: 'binary'
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * Output format: [16-byte IV][16-byte auth tag][ciphertext]
 */
export function encryptFile(plaintext: Buffer): EncryptedFile {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Prepend IV and auth tag so we can decrypt without separate metadata storage
  const data = Buffer.concat([iv, authTag, ciphertext])
  return { data, algorithm: 'aes-256-gcm', encoding: 'binary' }
}

/**
 * Decrypts a buffer encrypted with encryptFile().
 * Expected format: [16-byte IV][16-byte auth tag][ciphertext]
 */
export function decryptFile(encrypted: Buffer): Buffer {
  const key = getKey()
  const iv = encrypted.subarray(0, 16)
  const authTag = encrypted.subarray(16, 32)
  const ciphertext = encrypted.subarray(32)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
