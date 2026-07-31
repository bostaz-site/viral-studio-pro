import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicLinkToken } from '@/lib/partner/magic-link'
import { setPartnerCookie } from '@/lib/partner/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

// GET /api/partner/auth/verify?t=<token> — verify magic link + set session cookie
export async function GET(req: NextRequest) {
  void req // consumed for URL parsing only
  const token = new URL(req.url).searchParams.get('t')

  if (!token) {
    return NextResponse.redirect(new URL('/partner/login?error=invalid', APP_URL))
  }

  const result = await verifyMagicLinkToken(token)

  if (!result) {
    return NextResponse.redirect(new URL('/partner/login?error=expired', APP_URL))
  }

  // verifyMagicLinkToken consumed the magic link and created a long-lived session.
  // Set the cookie with the raw session token (no duplicate session creation).
  await setPartnerCookie(result.sessionToken)

  return NextResponse.redirect(new URL('/partner', APP_URL))
}
