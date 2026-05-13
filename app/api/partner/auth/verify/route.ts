import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicLinkToken } from '@/lib/partner/magic-link'
import { createPartnerSession, setPartnerCookie } from '@/lib/partner/auth'
import { hashIp } from '@/lib/admin/ip-hash'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

// GET /api/partner/auth/verify?t=<token> — verify magic link + set session
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('t')

  if (!token) {
    return NextResponse.redirect(new URL('/partner/login?error=invalid', APP_URL))
  }

  const result = await verifyMagicLinkToken(token)

  if (!result) {
    return NextResponse.redirect(new URL('/partner/login?error=expired', APP_URL))
  }

  // Create session
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ipHash = ip ? hashIp(ip) : undefined
  const userAgent = req.headers.get('user-agent') ?? undefined

  const sessionToken = await createPartnerSession(result.influencerId, ipHash, userAgent)
  await setPartnerCookie(sessionToken)

  return NextResponse.redirect(new URL('/partner', APP_URL))
}
