/**
 * Distributed rate limiter using Upstash Redis sliding window counter.
 *
 * Redis key = `rl:{identifier}`, value = counter, TTL = window in seconds.
 * Each request does INCR + EXPIRE (on first hit).
 * Works across all serverless isolates.
 *
 * Failure modes:
 * - Fail-open (default): if Redis is unreachable, allow the request.
 * - Fail-closed ({ failClosed: true }): if Redis is unreachable, DENY with 503.
 */

import { redis } from '@/lib/upstash'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  retryAfterMs?: number
}

export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000,
  options?: { failClosed?: boolean },
): Promise<RateLimitResult> {
  try {
    const key = `rl:${identifier}`
    const windowSec = Math.ceil(windowMs / 1000)

    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSec)
    }

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        limit,
        retryAfterMs: windowMs,
      }
    }

    return {
      allowed: true,
      remaining: limit - count,
      limit,
    }
  } catch {
    // Redis unreachable
    if (options?.failClosed) {
      return { allowed: false, remaining: 0, limit, retryAfterMs: windowMs }
    }
    // Fail-open: allow the request
    return { allowed: true, remaining: limit, limit }
  }
}

/**
 * Preset rate limits for different route types.
 */
export const RATE_LIMITS = {
  /** Expensive AI operations (render, mood detection) */
  ai: { limit: 5, windowMs: 60_000 },

  /** Standard API calls */
  standard: { limit: 30, windowMs: 60_000 },

  /** Upload operations */
  upload: { limit: 10, windowMs: 60_000 },

  /** Webhook endpoints (higher limit) */
  webhook: { limit: 100, windowMs: 60_000 },

  /** Browse / trending feed */
  browse: { limit: 60, windowMs: 60_000 },

  /** Video URL resolution */
  videoUrl: { limit: 30, windowMs: 60_000 },

  /** Render status polling */
  status: { limit: 120, windowMs: 60_000 },

  /** Data endpoints (sparkline, remixes) */
  data: { limit: 30, windowMs: 60_000 },
} as const
