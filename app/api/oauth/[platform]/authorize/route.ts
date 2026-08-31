import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeEncrypt } from '@/lib/crypto'
import { isPlatform, buildAuthUrl, PLATFORM_CONFIGS } from '@/lib/distribution/platforms'
import { isComingSoonPlatform } from '@/lib/distribution/launch-platforms'
import { randomBytes } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platformParam = params.platform
  const returnTo = req.nextUrl.searchParams.get('redirect') ?? null

  if (!platformParam || !isPlatform(platformParam)) {
    const redirectUrl = new URL('/settings', APP_URL)
    redirectUrl.searchParams.set('oauth_error', `Unsupported platform: ${platformParam}`)
    return NextResponse.redirect(redirectUrl.toString())
  }

  // Verify user is authenticated (needed before gating check for META_PREVIEW_EMAILS)
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(new URL('/login', APP_URL).toString())
  }

  if (isComingSoonPlatform(platformParam, user.email ?? undefined)) {
    const redirectUrl = new URL('/settings', APP_URL)
    redirectUrl.searchParams.set('oauth_error', `${PLATFORM_CONFIGS[platformParam].displayName} is coming soon.`)
    return NextResponse.redirect(redirectUrl.toString())
  }

  // Build state with user_id + nonce for CSRF protection
  const nonce = randomBytes(16).toString('hex')
  const statePayload = JSON.stringify({
    userId: user.id,
    nonce,
    platform: platformParam,
    ts: Date.now(),
    returnTo,
  })

  const encryptedState = safeEncrypt(statePayload)
  if (!encryptedState) {
    const redirectUrl = new URL('/settings', APP_URL)
    redirectUrl.searchParams.set('oauth_error', 'Failed to generate OAuth state. Check ENCRYPTION_SECRET.')
    return NextResponse.redirect(redirectUrl.toString())
  }

  // Base64url-encode the encrypted state so it's URL-safe
  const stateParam = Buffer.from(encryptedState, 'utf-8').toString('base64url')

  let authUrl: string
  try {
    authUrl = buildAuthUrl(platformParam, stateParam)
  } catch {
    const redirectUrl = new URL('/settings', APP_URL)
    redirectUrl.searchParams.set('oauth_error', `Failed to build auth URL for ${platformParam}. Check platform credentials.`)
    return NextResponse.redirect(redirectUrl.toString())
  }

  return NextResponse.redirect(authUrl)
}
