import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 1]
}

// GET — influencer affiliate detail with referrals + ledger
export const GET = withAdmin(async (req) => {
  const id = extractId(req)
  const supabase = createAdminClient()

  const [influencerRes, referralsRes, ledgerRes, clicksRes] = await Promise.all([
    supabase.from('influencers')
      .select('id, email, display_name, platform_handle, affiliate_code, status, total_referrals, total_paying_referrals, total_commission_earned_cents, total_commission_paid_cents')
      .eq('id', id)
      .single(),
    supabase.from('affiliate_referrals')
      .select('id, user_id, attribution_type, status, total_revenue_cents, total_commission_cents, first_paid_at, created_at')
      .eq('influencer_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('affiliate_commission_ledger')
      .select('id, event_type, amount_cents, currency, stripe_invoice_id, stripe_charge_id, notes, created_at')
      .eq('influencer_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('affiliate_clicks')
      .select('id, ip_country, utm_source, utm_medium, signup_user_id, clicked_at')
      .eq('influencer_id', id)
      .order('clicked_at', { ascending: false })
      .limit(50),
  ])

  if (influencerRes.error) return errorResponse('Influencer not found', 404)

  // Compute balance from ledger
  const totalEarned = (ledgerRes.data ?? [])
    .filter(e => e.amount_cents > 0)
    .reduce((sum, e) => sum + e.amount_cents, 0)
  const totalClawback = (ledgerRes.data ?? [])
    .filter(e => e.amount_cents < 0)
    .reduce((sum, e) => sum + e.amount_cents, 0)

  return jsonResponse({
    influencer: influencerRes.data,
    referrals: referralsRes.data ?? [],
    ledger: ledgerRes.data ?? [],
    clicks: clicksRes.data ?? [],
    balance: {
      earned_cents: totalEarned,
      clawback_cents: totalClawback,
      available_cents: totalEarned + totalClawback,
    },
  })
})
