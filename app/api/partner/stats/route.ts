import { NextResponse } from 'next/server'
import { requirePartnerAuth } from '@/lib/partner/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/partner/stats — partner dashboard stats
export async function GET() {
  const auth = await requirePartnerAuth()
  if (!auth) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { influencerId, influencer } = auth

  // Total clicks
  const { count: totalClicks } = await admin
    .from('affiliate_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)

  // This month clicks
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count: monthClicks } = await admin
    .from('affiliate_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .gte('clicked_at', monthStart.toISOString())

  // Signups (affiliate_referrals)
  const { count: totalSignups } = await admin
    .from('affiliate_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)

  // Paying customers
  const { count: payingCount } = await admin
    .from('affiliate_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .eq('status', 'paying')

  // Total earned (from ledger)
  const { data: ledgerTotals } = await admin
    .from('affiliate_commission_ledger')
    .select('amount_cents')
    .eq('influencer_id', influencerId)

  const totalEarnedCents = (ledgerTotals || []).reduce(
    (sum, row) => sum + (row.amount_cents || 0),
    0
  )

  // This month earned
  const { data: monthLedger } = await admin
    .from('affiliate_commission_ledger')
    .select('amount_cents')
    .eq('influencer_id', influencerId)
    .gte('created_at', monthStart.toISOString())

  const monthEarnedCents = (monthLedger || []).reduce(
    (sum, row) => sum + (row.amount_cents || 0),
    0
  )

  // Next payout info
  const { data: pendingPayout } = await admin
    .from('affiliate_payouts')
    .select('id, net_payout_cents, status, period_end_at')
    .eq('influencer_id', influencerId)
    .in('status', ['pending_review', 'approved', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Onboarding status (for /partner/onboarding page)
  const { data: onboardingInfo } = await admin
    .from('influencers')
    .select('stripe_connect_status, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_onboarded_at')
    .eq('id', influencerId)
    .single()

  return NextResponse.json({
    data: {
      influencer: {
        name: influencer.first_name || influencer.display_name || 'Partner',
        email: influencer.email,
        affiliate_code: influencer.affiliate_code,
      },
      clicks: { total: totalClicks || 0, thisMonth: monthClicks || 0 },
      signups: totalSignups || 0,
      paying: payingCount || 0,
      earnings: {
        totalCents: totalEarnedCents,
        thisMonthCents: monthEarnedCents,
      },
      nextPayout: pendingPayout
        ? {
            amountCents: pendingPayout.net_payout_cents,
            status: pendingPayout.status,
            periodEnd: pendingPayout.period_end_at,
          }
        : null,
      onboarding: onboardingInfo
        ? {
            stripe_connect_status: onboardingInfo.stripe_connect_status,
            stripe_connect_charges_enabled: onboardingInfo.stripe_connect_charges_enabled,
            stripe_connect_payouts_enabled: onboardingInfo.stripe_connect_payouts_enabled,
            stripe_connect_onboarded_at: onboardingInfo.stripe_connect_onboarded_at,
          }
        : null,
    },
    error: null,
  })
}
