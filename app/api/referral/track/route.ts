import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const trackSchema = z.object({
  handle: z.string().min(1).max(30),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = trackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { handle, utm_source, utm_medium, utm_campaign } = parsed.data

  // Find affiliate by handle
  const { data: affiliate, error: affErr } = await supabase
    .from('affiliates')
    .select('id, status')
    .eq('handle', handle.toLowerCase())
    .single()

  if (affErr || !affiliate) {
    return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
  }

  if (affiliate.status !== 'active') {
    return NextResponse.json({ error: 'Affiliate is not active' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  // Create referral click record
  const { error: refErr } = await supabase
    .from('referrals')
    .insert({
      affiliate_id: affiliate.id,
      source: 'link',
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      status: 'clicked',
      ip_address: ip,
      user_agent: ua,
    })

  if (refErr) {
    return NextResponse.json({ error: refErr.message }, { status: 500 })
  }

  // Increment affiliate click count
  const { data: currentAff } = await supabase
    .from('affiliates')
    .select('total_clicks')
    .eq('id', affiliate.id)
    .single()

  await supabase
    .from('affiliates')
    .update({ total_clicks: (currentAff?.total_clicks ?? 0) + 1 })
    .eq('id', affiliate.id)

  return NextResponse.json({ data: { tracked: true }, error: null, message: 'ok' })
}
