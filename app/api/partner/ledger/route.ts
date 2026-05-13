import { NextRequest, NextResponse } from 'next/server'
import { requirePartnerAuth } from '@/lib/partner/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/partner/ledger — commission history + referrals (anonymized)
export async function GET(req: NextRequest) {
  const auth = await requirePartnerAuth()
  if (!auth) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { influencerId } = auth
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 50

  // Commission ledger entries
  const from = (page - 1) * limit
  const { data: ledger, count } = await admin
    .from('affiliate_commission_ledger')
    .select('id, event_type, amount_cents, currency, created_at, notes', { count: 'exact' })
    .eq('influencer_id', influencerId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  // Recent referrals (anonymized — no real user info exposed)
  const { data: referrals } = await admin
    .from('affiliate_referrals')
    .select('id, status, signed_up_at, first_paid_at, total_revenue_cents, total_commission_cents, created_at')
    .eq('influencer_id', influencerId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Anonymize referrals: use short ID hash instead of real user info
  const anonymizedReferrals = (referrals || []).map((r, i) => ({
    label: `User #${r.id.slice(0, 4).toUpperCase()}`,
    status: r.status,
    signedUpAt: r.signed_up_at,
    firstPaidAt: r.first_paid_at,
    revenueCents: r.total_revenue_cents,
    commissionCents: r.total_commission_cents,
  }))

  // Past payouts
  const { data: payouts } = await admin
    .from('affiliate_payouts')
    .select('id, net_payout_cents, status, period_start_at, period_end_at, sent_at, created_at')
    .eq('influencer_id', influencerId)
    .order('created_at', { ascending: false })
    .limit(12)

  return NextResponse.json({
    data: {
      ledger: ledger || [],
      total: count || 0,
      page,
      hasMore: (ledger?.length || 0) === limit,
      referrals: anonymizedReferrals,
      payouts: payouts || [],
    },
    error: null,
  })
}
