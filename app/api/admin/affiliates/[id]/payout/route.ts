import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const payoutSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
  period_start: z.string().datetime().optional(),
  period_end: z.string().datetime().optional(),
})

function extractAffiliateId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  // /api/admin/affiliates/[id]/payout → id is at index -2
  return segments[segments.length - 2]
}

export const POST = withAdmin(async (req) => {
  const affiliateId = extractAffiliateId(req)
  const body = await req.json()
  const parsed = payoutSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()

  // Verify affiliate exists
  const { data: affiliate, error: affErr } = await supabase
    .from('affiliates')
    .select('id, total_commission_earned, total_commission_paid')
    .eq('id', affiliateId)
    .single()

  if (affErr || !affiliate) return errorResponse('Affiliate not found', 404)

  const { amount, notes, period_start, period_end } = parsed.data

  // Create payout record
  const amountCents = Math.round(amount * 100)
  const { data: payout, error } = await supabase
    .from('affiliate_payouts')
    .insert({
      influencer_id: affiliateId,
      gross_commission_cents: amountCents,
      net_payout_cents: amountCents,
      referrals_count: 0,
      period_start_at: period_start ?? new Date().toISOString(),
      period_end_at: period_end ?? new Date().toISOString(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)

  // Update affiliate's total_commission_paid
  await supabase
    .from('affiliates')
    .update({
      total_commission_paid: (affiliate.total_commission_paid ?? 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', affiliateId)

  return jsonResponse(payout)
})
