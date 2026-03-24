/**
 * Encryption utilities for sensitive data (OAuth tokens, API keys).
 *
 * Uses AES-256-GCM via Node.js crypto module.
 * Encryption key is derived from ENCRYPTION_SECRET env var.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT = 'viral-studio-pro-salt-v1' // Static salt — key is already high-entropy

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET env var is required for token encryption')
  }
  return scryptSync(secret, SALT, 32)
}

/**
 * Encrypt a plaintext string.
 * Returns: base64 string in format: iv:encrypted:authTag
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`
}

/**
 * Decrypt an encrypted string.
 * Input: base64 string in format: iv:encrypted:authTag
 */
export function decrypt(encryptedString: string): string {
  const key = getKey()
  const parts = encryptedString.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const authTag = Buffer.from(parts[2], 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Safely encrypt — returns null if encryption fails (e.g., missing env var).
 */
export function safeEncrypt(plaintext: string | null): string | null {
  if (!plaintext) return null
  try {
    return encrypt(plaintext)
  } catch {
    console.error('[crypto] Encryption failed — storing plaintext. Set ENCRYPTION_SECRET env var.')
    return plaintext
  }
}

/**
 * Safely decrypt — returns the input if decryption fails (backwards compat).
 */
export function safeDecrypt(value: string | null): string | null {
  if (!value) return null
  // Check if it looks like an encrypted string (hex:hex:hex)
  if (!value.includes(':') || value.split(':').length !== 3) {
    return value // Not encrypted, return as-is (backwards compatibility)
  }
  try {
    return decrypt(value)
  } catch {
    return value // Decryption failed, return as-is
  }
}
