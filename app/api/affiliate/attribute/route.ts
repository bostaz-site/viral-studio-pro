import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  // Also accept from request body (localStorage fallback from signup form)
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
