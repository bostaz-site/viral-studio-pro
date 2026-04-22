import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  platform: z.string().max(30).nullable().optional(),
  niche: z.string().max(50).nullable().optional(),
  commission_rate: z.number().min(0).max(1).optional(),
  promo_discount_percent: z.number().int().min(5).max(50).optional(),
  status: z.enum(['active', 'paused', 'inactive']).optional(),
  notes: z.string().max(500).nullable().optional(),
})

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 1]
}

// GET — affiliate detail with referrals and payouts
export const GET = withAdmin(async (req) => {
  const id = extractId(req)
  const supabase = createAdminClient()

  const [affiliateRes, referralsRes, payoutsRes] = await Promise.all([
    supabase.from('affiliates').select('*').eq('id', id).single(),
    supabase
      .from('referrals')
      .select('*')
      .eq('affiliate_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('affiliate_payouts')
      .select('*')
      .eq('affiliate_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (affiliateRes.error) return errorResponse('Affiliate not found', 404)

  return jsonResponse({
    affiliate: affiliateRes.data,
    referrals: referralsRes.data ?? [],
    payouts: payoutsRes.data ?? [],
  })
})

// PATCH — update affiliate
export const PATCH = withAdmin(async (req) => {
  const id = extractId(req)
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('affiliates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// DELETE — remove affiliate
export const DELETE = withAdmin(async (req) => {
  const id = extractId(req)
  const supabase = createAdminClient()

  const { error } = await supabase.from('affiliates').delete().eq('id', id)
  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ deleted: true })
})
