import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  handle: z.string().min(2).max(30).regex(/^[a-z0-9_-]+$/i, 'Handle must be alphanumeric'),
  platform: z.enum(['twitch', 'youtube', 'tiktok', 'instagram']).optional(),
  niche: z.string().max(50).optional(),
  commission_rate: z.number().min(0).max(1).optional(),
  promo_discount_percent: z.number().int().min(5).max(50).optional(),
  notes: z.string().max(500).optional(),
})

// GET — list all affiliates
export const GET = withAdmin(async (req) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  let query = supabase
    .from('affiliates')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST — create new affiliate
export const POST = withAdmin(async (req) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()
  const { handle, promo_discount_percent, ...rest } = parsed.data

  const discount = promo_discount_percent ?? 20
  const promoCode = `${handle.toUpperCase()}${discount}`

  const { data, error } = await supabase
    .from('affiliates')
    .insert({
      ...rest,
      handle: handle.toLowerCase(),
      promo_code: promoCode,
      promo_discount_percent: discount,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return errorResponse('Handle or promo code already exists', 409)
    }
    return errorResponse(error.message, 500)
  }

  return jsonResponse(data)
})
