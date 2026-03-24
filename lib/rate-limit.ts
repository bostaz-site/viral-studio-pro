/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach per identifier (user ID or IP).
 *
 * NOTE: This works per-instance only. For multi-instance deployments,
 * use Redis or Upstash instead. Sufficient for Netlify single-instance.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  retryAfterMs?: number
}

/**
 * Check and consume a rate limit token.
 *
 * @param identifier - Unique key (e.g., userId, IP address)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  cleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs

  let entry = store.get(identifier)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(identifier, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now

    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterMs: Math.max(0, retryAfterMs),
    }
  }

  // Consume a token
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    limit,
  }
}

/**
 * Preset rate limits for different route types.
 */
export const RATE_LIMITS = {
  /** Expensive AI operations (Whisper, Claude) */
  ai: { limit: 5, windowMs: 60_000 },

  /** Standard API calls */
  standard: { limit: 30, windowMs: 60_000 },

  /** Upload operations */
  upload: { limit: 10, windowMs: 60_000 },

  /** Webhook endpoints (higher limit) */
  webhook: { limit: 100, windowMs: 60_000 },
} as const
