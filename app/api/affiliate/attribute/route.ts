import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { attributeSignup } from '@/lib/admin/affiliate-attribution'
import { cookies } from 'next/headers'

/**
 * POST /api/affiliate/attribute
 * Called client-side right after signup succeeds.
 * Reads va_ref cookie server-side and calls attributeSignup().
 * Idempotent: duplicate user_id is silently ignored (unique index).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Read affiliate code from cookie (set by /r/[code])
  const cookieStore = await cookies()
  const affiliateCode = cookieStore.get('va_ref')?.value ?? null

  // Also accept from request body — but ONLY if a recent affiliate_click exists for this code
  // (prevents arbitrary body injection without a real click)
  let bodyCode: string | null = null
  try {
    const body = await req.json()
    bodyCode = body.affiliateCode ?? body.affiliate_code ?? null
  } catch {
    // No body or invalid JSON — that's fine
  }

  const code = affiliateCode || bodyCode
  if (!code) {
    return NextResponse.json({ data: null, message: 'No affiliate code found' })
  }

  // Body-only code (no cookie) requires a recent click to exist
  if (!affiliateCode && bodyCode) {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
    const { data: click } = await admin
      .from('affiliate_clicks')
      .select('id')
      .eq('affiliate_code', bodyCode)
      .gte('clicked_at', cutoff)
      .limit(1)
      .maybeSingle()

    if (!click) {
      return NextResponse.json({ data: null, message: 'No valid click found for this code' })
    }
  }

  // Self-referral check: reject if user's email matches the influencer's email/domain
  const admin = createAdminClient()
  const { data: influencer } = await admin
    .from('influencers')
    .select('id, email')
    .eq('affiliate_code', code)
    .maybeSingle()

  if (influencer && user.email) {
    const userEmail = user.email.toLowerCase()
    const infEmail = (influencer.email ?? '').toLowerCase()
    if (infEmail && userEmail === infEmail) {
      return NextResponse.json(
        { data: null, error: 'self_referral', message: 'Cannot use your own affiliate code' },
        { status: 403 },
      )
    }
  }

  const result = await attributeSignup({
    userId: user.id,
    affiliateCode: code,
  })

  if (!result) {
    return NextResponse.json({ data: null, message: 'No attribution match or already attributed' })
  }

  // Clear the cookie after successful attribution
  const response = NextResponse.json({
    data: { influencerId: result.influencerId, attributionType: result.attributionType },
    message: 'Attribution recorded',
  })
  response.cookies.set('va_ref', '', { maxAge: 0, path: '/' })

  return response
}
