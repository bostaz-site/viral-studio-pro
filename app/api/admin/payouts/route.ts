import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/payouts — list all payouts with influencer info
export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const url = req.nextUrl
  const status = url.searchParams.get('status')
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 50
  const offset = (page - 1) * limit

  let query = admin
    .from('affiliate_payouts')
    .select(`
      id, influencer_id, period_start_at, period_end_at,
      gross_commission_cents, adjustments_cents, net_payout_cents,
      referrals_count, status, stripe_transfer_id, stripe_transfer_status,
      failure_reason, created_at, sent_at
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: payouts, error } = await query

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  // Enrich with influencer names (batch)
  const influencerIds = [...new Set((payouts || []).map(p => p.influencer_id))]
  const { data: influencers } = await admin
    .from('influencers')
    .select('id, email, first_name, last_name, display_name, affiliate_code, platform_handle')
    .in('id', influencerIds.length > 0 ? influencerIds : ['__none__'])

  const influencerMap = new Map(
    (influencers || []).map(i => [i.id, i])
  )

  const enriched = (payouts || []).map(p => ({
    ...p,
    influencer: influencerMap.get(p.influencer_id) || null,
  }))

  // Summary stats
  const { data: summary } = await admin
    .from('v_payout_summary_current_month')
    .select('*')
    .maybeSingle()

  return NextResponse.json({
    data: {
      payouts: enriched,
      summary: summary || { pending_count: 0, sent_count: 0, on_hold_count: 0, failed_count: 0 },
      page,
    },
    error: null,
  })
})
