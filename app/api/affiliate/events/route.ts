import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface ReferralEventRow {
  id: string
  affiliate_code_id: string
  event_type: string
  referred_user_id: string | null
  amount: number | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// affiliate_codes and referral_events tables are in generated Supabase types.

/**
 * GET /api/affiliate/events
 * Returns paginated referral events for the current user's affiliate code.
 * Query params: limit (default 20, max 50), offset (default 0), event_type (optional filter)
 */
export const GET = withAuth(async (req: NextRequest, user) => {
  const rl = await rateLimit(`affiliate:${user.id}`, RATE_LIMITS.data.limit, RATE_LIMITS.data.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  const admin = createAdminClient()
  const db = admin
  const params = req.nextUrl.searchParams
  const limit = Math.min(Number(params.get('limit') ?? '20'), 50)
  const offset = Math.max(Number(params.get('offset') ?? '0'), 0)
  const eventType = params.get('event_type')

  // Get the user's affiliate code
  const { data: affiliate } = await db
    .from('affiliate_codes')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { id: string } | null }

  if (!affiliate) {
    return NextResponse.json({
      data: [],
      error: null,
      message: 'No affiliate code found',
      meta: { total: 0, limit, offset },
    })
  }

  // Build query
  let query = db
    .from('referral_events')
    .select('*', { count: 'exact' })
    .eq('affiliate_code_id', affiliate.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (eventType && ['click', 'signup', 'conversion', 'payout'].includes(eventType)) {
    query = query.eq('event_type', eventType)
  }

  const { data: events, error, count } = await query as {
    data: ReferralEventRow[] | null
    error: { message: string } | null
    count: number | null
  }

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Failed to fetch events' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: events ?? [],
    error: null,
    message: 'OK',
    meta: { total: count ?? 0, limit, offset },
  })
})
