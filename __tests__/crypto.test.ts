import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Crypto utilities', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_SECRET: 'test-secret-key-for-unit-tests-32chars!' }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('encrypt + decrypt roundtrip works', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const plaintext = 'my-super-secret-oauth-token'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted.split(':')).toHaveLength(3)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('different encryptions produce different ciphertexts (random IV)', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const plaintext = 'same-input'
    const enc1 = encrypt(plaintext)
    const enc2 = encrypt(plaintext)
    expect(enc1).not.toBe(enc2) // Different IVs
  })

  it('safeEncrypt throws when ENCRYPTION_SECRET is missing', async () => {
    process.env.ENCRYPTION_SECRET = ''
    delete process.env.ENCRYPTION_SECRET
    const { safeEncrypt } = await import('@/lib/crypto')
    expect(() => safeEncrypt('test')).toThrow('ENCRYPTION_SECRET')
  })

  it('safeEncrypt returns null for null input', async () => {
    const { safeEncrypt } = await import('@/lib/crypto')
    expect(safeEncrypt(null)).toBe(null)
  })

  it('safeDecrypt returns unencrypted strings as-is (backwards compat)', async () => {
    const { safeDecrypt } = await import('@/lib/crypto')
    expect(safeDecrypt('plain-text-token')).toBe('plain-text-token')
  })

  it('timingSafeCompare works correctly', async () => {
    const { timingSafeCompare } = await import('@/lib/crypto')
    expect(timingSafeCompare('abc', 'abc')).toBe(true)
    expect(timingSafeCompare('abc', 'def')).toBe(false)
    expect(timingSafeCompare('short', 'much-longer-string')).toBe(false)
  })
})
