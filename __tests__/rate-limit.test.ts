import { describe, it, expect } from 'vitest'
import { rateLimit } from '@/lib/rate-limit'

describe('Rate limiter', () => {
  it('allows requests under the limit', () => {
    const id = `test-user-${Date.now()}`
    const result = rateLimit(id, 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests at the limit', () => {
    const id = `test-user-block-${Date.now()}`
    // Consume all 3 tokens
    rateLimit(id, 3, 60_000)
    rateLimit(id, 3, 60_000)
    rateLimit(id, 3, 60_000)
    // 4th should be blocked
    const result = rateLimit(id, 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('different identifiers have separate limits', () => {
    const id1 = `user-a-${Date.now()}`
    const id2 = `user-b-${Date.now()}`
    // Exhaust id1
    rateLimit(id1, 1, 60_000)
    const blocked = rateLimit(id1, 1, 60_000)
    expect(blocked.allowed).toBe(false)
    // id2 should still be allowed
    const allowed = rateLimit(id2, 1, 60_000)
    expect(allowed.allowed).toBe(true)
  })

  it('allows requests after window expires', async () => {
    const id = `test-window-${Date.now()}`
    // Use a very short window (50ms)
    rateLimit(id, 1, 50)
    // Wait for the window to expire
    await new Promise(resolve => setTimeout(resolve, 60))
    const result = rateLimit(id, 1, 50)
    expect(result.allowed).toBe(true)
  })
})
