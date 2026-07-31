import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit as redisRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Events the client is allowed to send. Whitelisting prevents the endpoint
// from becoming a free-form dumping ground for arbitrary strings.
const ALLOWED_EVENTS = new Set([
  'page_view',
  'landing_cta_clicked',
  'signup_started',
  'signup_completed',
  'demo_view',
  'demo_clip_switch',
  'demo_caption_switch',
  'demo_split_toggle',
  'demo_cta_click',
  'cta_hero_click',
  'cta_pricing_click',
  'cta_signup_click',
  'exit_intent_shown',
  'exit_intent_submitted',
  'exit_intent_dismissed',
  'changelog_view',
  'newsletter_submitted',
  'pricing_view',
  'clip_enhance_started',
  'chain_farm_next_clip',
  'paywall_shown',
  'paywall_upgrade_clicked',
  'paywall_topup_clicked',
  'paywall_referral_clicked',
  'paywall_save_used',
  'paywall_dismissed',
])

const eventSchema = z.object({
  name: z.string().min(1).max(100),
  session_id: z.string().min(6).max(64),
  page_path: z.string().max(512).optional(),
  referrer: z.string().max(512).optional(),
  utm_source: z.string().max(64).optional(),
  utm_medium: z.string().max(64).optional(),
  utm_campaign: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const bodySchema = z.union([
  eventSchema,
  z.object({ events: z.array(eventSchema).min(1).max(20) }),
])

// In-memory rate limit — best-effort, one session_id ~ 120 events / 5 minutes.
const LIMIT = 120
const WINDOW_MS = 5 * 60 * 1000
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string, n: number): boolean {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: n, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count + n > LIMIT) return false
  entry.count += n
  return true
}

export async function POST(req: NextRequest) {
  const { getClientIp } = await import('@/lib/api/client-ip')
  const ip = getClientIp(req)
  const ipRl = await redisRateLimit(`browse:${ip}`, RATE_LIMITS.browse.limit, RATE_LIMITS.browse.windowMs)
  if (!ipRl.allowed) {
    return NextResponse.json({ data: null, error: 'rate_limited' }, { status: 429 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    const json = await req.json()
    parsed = bodySchema.parse(json)
  } catch {
    return NextResponse.json(
      { data: null, error: 'invalid_body' },
      { status: 400 },
    )
  }

  const rawEvents = 'events' in parsed ? parsed.events : [parsed]
  // Filter to allowed events — don't reject the whole batch for one unknown event
  const events = rawEvents.filter(e => {
    if (ALLOWED_EVENTS.has(e.name)) return true
    logger.warn(`[analytics] Unknown event name rejected: ${e.name}`)
    return false
  })
  if (events.length === 0) {
    return NextResponse.json({ data: { accepted: 0 }, error: null })
  }
  const sessionId = events[0]?.session_id ?? 'unknown'

  if (!rateLimit(sessionId, events.length)) {
    return NextResponse.json(
      { data: null, error: 'rate_limited' },
      { status: 429 },
    )
  }

  const supabase = createAdminClient()

  const rows = events.map((e) => ({
    session_id: e.session_id,
    event_name: e.name,
    page_path: e.page_path ?? null,
    referrer: e.referrer ?? null,
    utm_source: e.utm_source ?? null,
    utm_medium: e.utm_medium ?? null,
    utm_campaign: e.utm_campaign ?? null,
    metadata: e.metadata ?? {},
  }))

  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>
    }
  })
    .from('analytics_events')
    .insert(rows)

  if (error) {
    // Never block the UI on analytics failures — log and return 200.
    logger.error('[analytics] insert failed:', error.message)
    return NextResponse.json({ data: null, error: 'insert_failed' }, { status: 200 })
  }

  return NextResponse.json({ data: { accepted: rows.length }, error: null })
}
