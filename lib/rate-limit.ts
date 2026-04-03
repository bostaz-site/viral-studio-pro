/**
 * Hybrid rate limiter: in-memory for single-instance + Supabase fallback.
 *
 * On serverless (Netlify Functions), each cold start gets a fresh Map.
 * The in-memory limiter still helps within a warm instance, and the
 * Supabase-based limiter provides persistent cross-instance protection.
 *
 * For MVP this is sufficient. For scale, migrate to Upstash Redis.
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
 * Check and consume a rate limit token (in-memory, per-instance).
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
 * Supabase-based rate limiter for persistent cross-instance limiting.
 * Uses a dedicated table `rate_limit_log` for tracking requests.
 * Falls back to allowing the request if the DB check fails (fail-open).
 */
export async function rateLimitDb(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  identifier: string,
  limit: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_limit: limit,
      p_window_ms: windowMs,
    })

    if (error || data === null) {
      // Fail-open: if DB check fails, allow the request
      // but still check in-memory as a safety net
      return rateLimit(identifier, limit, windowMs)
    }

    const allowed = Boolean(data)
    return {
      allowed,
      remaining: allowed ? limit - 1 : 0,
      limit,
      retryAfterMs: allowed ? undefined : windowMs,
    }
  } catch {
    // Fail-open with in-memory fallback
    return rateLimit(identifier, limit, windowMs)
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
