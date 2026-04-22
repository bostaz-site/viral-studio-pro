import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const bodySchema = z.object({
  email: z.string().email().max(254),
  source: z.string().max(64).optional(),
})

// Very light in-memory rate limit — one IP can submit ~5 times per hour.
// Not bulletproof (resets on cold start), but kills drive-by spam.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const hits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

function hashIp(ip: string): string {
  const salt = process.env.NEWSLETTER_IP_SALT ?? 'viral-studio-pro'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>
  try {
    const json = await req.json()
    parsed = bodySchema.parse(json)
  } catch {
    return NextResponse.json(
      { data: null, error: 'invalid_body', message: 'Email invalide.' },
      { status: 400 },
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { data: null, error: 'rate_limited', message: 'Too many attempts. Try again later.' },
      { status: 429 },
    )
  }

  const email = parsed.email.trim().toLowerCase()
  const supabase = createAdminClient()

  // newsletter_leads isn't in the generated Database types yet — cast the
  // client so we can insert without triggering strict schema checks.
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>
    }
  })
    .from('newsletter_leads')
    .insert({
      email,
      source: parsed.source ?? 'landing_footer',
      user_agent: req.headers.get('user-agent')?.slice(0, 512) ?? null,
      referrer: req.headers.get('referer')?.slice(0, 512) ?? null,
      ip_hash: hashIp(ip),
    })

  if (error) {
    // Unique violation = already subscribed. Treat as success for UX.
    if (error.code === '23505') {
      return NextResponse.json({
        data: { alreadySubscribed: true },
        error: null,
        message: 'Already subscribed — thanks!',
      })
    }
    console.error('[newsletter] insert failed:', error)
    return NextResponse.json(
      { data: null, error: 'db_error', message: 'Server error. Try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: { alreadySubscribed: false },
    error: null,
    message: 'Subscribed! Check your inbox soon.',
  })
}
