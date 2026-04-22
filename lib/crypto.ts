/**
 * Encryption utilities for sensitive data (OAuth tokens, API keys).
 *
 * Uses AES-256-GCM via Node.js crypto module.
 * Encryption key is derived from ENCRYPTION_SECRET env var.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET env var is required for token encryption')
  }
  // Use a random salt per-deployment stored alongside the secret,
  // or a unique per-app salt derived from the secret itself.
  // For key derivation, we hash the secret with a per-app prefix.
  const salt = Buffer.from(`vsp-${secret.slice(0, 8)}-salt`, 'utf8')
  return scryptSync(secret, salt, 32)
}

/**
 * Encrypt a plaintext string.
 * Returns: hex string in format: iv:encrypted:authTag
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
 * Input: hex string in format: iv:encrypted:authTag
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
 * Safely encrypt — throws if encryption fails.
 * NEVER falls back to plaintext to prevent accidental secret exposure.
 */
export function safeEncrypt(plaintext: string | null): string | null {
  if (!plaintext) return null
  // If ENCRYPTION_SECRET is not set, refuse to store the value
  if (!process.env.ENCRYPTION_SECRET) {
    throw new Error(
      'Cannot store sensitive data: ENCRYPTION_SECRET env var is not set. ' +
      'Set it before connecting OAuth accounts.'
    )
  }
  return encrypt(plaintext)
}

/**
 * Safely decrypt — returns the input if it's not in encrypted format (backwards compat).
 * Throws if decryption of an encrypted value fails (corrupted data).
 */
export function safeDecrypt(value: string | null): string | null {
  if (!value) return null
  // Check if it looks like an encrypted string (hex:hex:hex)
  if (!value.includes(':') || value.split(':').length !== 3) {
    return value // Not encrypted, return as-is (backwards compatibility)
  }
  // If it looks encrypted, it MUST decrypt successfully
  return decrypt(value)
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Still do a comparison to prevent length-based timing leak
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
