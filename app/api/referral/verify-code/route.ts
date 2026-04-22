import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const verifySchema = z.object({
  code: z.string().min(1).max(30),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()
  const code = parsed.data.code.toUpperCase()

  const { data: affiliate, error } = await supabase
    .from('affiliates')
    .select('id, handle, name, promo_code, promo_discount_percent, status')
    .eq('promo_code', code)
    .single()

  if (error || !affiliate) {
    return NextResponse.json({
      data: { valid: false },
      error: null,
      message: 'Invalid promo code',
    })
  }

  if (affiliate.status !== 'active') {
    return NextResponse.json({
      data: { valid: false },
      error: null,
      message: 'Promo code is no longer active',
    })
  }

  return NextResponse.json({
    data: {
      valid: true,
      discount_percent: affiliate.promo_discount_percent,
      affiliate_name: affiliate.name,
      affiliate_handle: affiliate.handle,
    },
    error: null,
    message: 'ok',
  })
}
