import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignAffiliateCodeOnOnboarded } from '@/lib/admin/affiliate-code'

// GET — list all influencers with affiliate_code (active affiliates)
export const GET = withAdmin(async (req) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const showAll = url.searchParams.get('all') === 'true'

  let query = supabase
    .from('influencers')
    .select('id, email, display_name, platform_handle, affiliate_code, status, total_referrals, total_paying_referrals, total_commission_earned_cents, total_commission_paid_cents, created_at')
    .order('total_commission_earned_cents', { ascending: false, nullsFirst: false })

  if (!showAll) {
    query = query.not('affiliate_code', 'is', null)
  }

  const { data, error } = await query.limit(200)
  if (error) return errorResponse(error.message, 500)

  return jsonResponse(data)
})

// POST — assign affiliate code to an influencer (manual trigger)
export const POST = withAdmin(async (req) => {
  const { influencer_id } = await req.json()
  if (!influencer_id) return errorResponse('influencer_id required')

  const code = await assignAffiliateCodeOnOnboarded(influencer_id)
  if (!code) return errorResponse('Already has code or influencer not found', 409)

  return jsonResponse({ affiliate_code: code })
})
