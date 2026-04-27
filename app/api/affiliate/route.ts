import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// ── Types ────────────────────────────────────────────────────────────────────

interface AffiliateCodeRow {
  id: string
  user_id: string
  code: string
  custom_handle: string | null
  clicks: number
  signups: number
  conversions: number
  total_earned: number
  commission_rate: number
  active: boolean
  created_at: string
}

// affiliate_codes and referral_events tables are in generated Supabase types.

// ── Handle blocklist ─────────────────────────────────────────────────────────

const BLOCKED_HANDLES = new Set([
  'admin', 'support', 'help', 'api', 'www', 'mail', 'ftp', 'smtp',
  'login', 'signup', 'settings', 'dashboard', 'billing', 'pricing',
  'blog', 'docs', 'status', 'abuse', 'spam', 'fuck', 'shit', 'ass',
  'dick', 'porn', 'sex', 'nude', 'nsfw', 'kill', 'die', 'nazi',
  'hitler', 'racist', 'nigger', 'faggot',
])

const handleSchema = z.string()
  .min(3).max(30)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Only lowercase letters, numbers and hyphens (must start/end with alphanumeric)')
  .refine(val => !BLOCKED_HANDLES.has(val), 'This handle is not available')

// ── Code generation ──────────────────────────────────────────────────────────

function generateCode(email: string, fullName: string | null): string {
  const base = (fullName || email.split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16)

  if (base.length >= 3) return base

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

async function createUniqueCode(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
  fullName: string | null,
): Promise<AffiliateCodeRow> {
  const code = generateCode(email, fullName)

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateCode = attempt === 0 ? code : `${code}${Math.floor(1000 + Math.random() * 9000)}`

    const { data: existing } = await db
      .from('affiliate_codes')
      .select('id')
      .eq('code', candidateCode)
      .maybeSingle() as { data: { id: string } | null }

    if (!existing) {
      const { data: created, error } = await db
        .from('affiliate_codes')
        .insert({ user_id: userId, code: candidateCode })
        .select('*')
        .single() as { data: AffiliateCodeRow | null; error: unknown }

      if (error || !created) continue
      return created
    }
  }

  const fallback = `ref-${crypto.randomUUID().slice(0, 8)}`
  const { data: created } = await db
    .from('affiliate_codes')
    .insert({ user_id: userId, code: fallback })
    .select('*')
    .single() as { data: AffiliateCodeRow | null; error: unknown }

  return created!
}

// ── GET — Fetch or auto-create affiliate code ────────────────────────────────

export const GET = withAuth(async (req: NextRequest, user) => {
  const rl = await rateLimit(`affiliate:${user.id}`, RATE_LIMITS.standard.limit, RATE_LIMITS.standard.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  const admin = createAdminClient()
  const db = admin

  let { data: affiliate } = await db
    .from('affiliate_codes')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle() as { data: AffiliateCodeRow | null }

  if (!affiliate) {
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    affiliate = await createUniqueCode(
      db,
      user.id,
      profile?.email ?? user.email ?? '',
      profile?.full_name ?? null,
    )
  }

  const handle = affiliate.custom_handle || affiliate.code
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

  return NextResponse.json({
    data: {
      id: affiliate.id,
      code: affiliate.code,
      custom_handle: affiliate.custom_handle,
      handle,
      link: `${appUrl}/ref/${handle}`,
      clicks: affiliate.clicks,
      signups: affiliate.signups,
      conversions: affiliate.conversions,
      total_earned: Number(affiliate.total_earned),
      commission_rate: Number(affiliate.commission_rate),
      active: affiliate.active,
      created_at: affiliate.created_at,
    },
    error: null,
    message: 'OK',
  })
})

// ── PATCH — Update custom handle ─────────────────────────────────────────────

const patchSchema = z.object({
  custom_handle: handleSchema,
})

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const rl = await rateLimit(`affiliate:${user.id}`, RATE_LIMITS.standard.limit, RATE_LIMITS.standard.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message, message: 'Invalid handle' },
      { status: 400 },
    )
  }

  const { custom_handle } = parsed.data
  const admin = createAdminClient()
  const db = admin

  // Verify user has an affiliate code
  const { data: affiliate } = await db
    .from('affiliate_codes')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { id: string } | null }

  if (!affiliate) {
    return NextResponse.json(
      { data: null, error: 'Affiliate code not found', message: 'Activate your affiliate code first' },
      { status: 404 },
    )
  }

  // Check handle uniqueness against other affiliate codes
  const { data: existingCode } = await db
    .from('affiliate_codes')
    .select('id')
    .eq('custom_handle', custom_handle)
    .neq('id', affiliate.id)
    .maybeSingle() as { data: { id: string } | null }

  if (existingCode) {
    return NextResponse.json(
      { data: null, error: 'Handle already taken', message: 'This handle is already in use' },
      { status: 409 },
    )
  }

  // Also check against admin affiliates table
  const { data: adminAffiliate } = await admin
    .from('affiliates')
    .select('id')
    .eq('handle', custom_handle)
    .maybeSingle()

  if (adminAffiliate) {
    return NextResponse.json(
      { data: null, error: 'Handle already taken', message: 'This handle is already in use' },
      { status: 409 },
    )
  }

  const { error: updateError } = await db
    .from('affiliate_codes')
    .update({ custom_handle })
    .eq('id', affiliate.id) as { error: { message: string } | null }

  if (updateError) {
    return NextResponse.json(
      { data: null, error: updateError.message, message: 'Failed to update handle' },
      { status: 500 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

  return NextResponse.json({
    data: { custom_handle, link: `${appUrl}/ref/${custom_handle}` },
    error: null,
    message: 'Handle updated',
  })
})
