import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeEncrypt } from '@/lib/crypto'
import { isPlatform, buildAuthUrl } from '@/lib/distribution/platforms'
import { randomBytes } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

export async function GET(
  _req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platformParam = params.platform

  if (!platformParam || !isPlatform(platformParam)) {
    const redirectUrl = new URL('/settings', APP_URL)
    redirectUrl.searchParams.set('oauth_error', `Unsupported platform: ${platformParam}`)
    return NextResponse.redirect(redirectUrl.toString())
  }

  // Verify user is authenticated
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(new URL('/login', APP_URL).toString())
  }

  // Build state with user_id + nonce for CSRF protection
  const nonce = randomBytes(16).toString('hex')
  const statePayload = JSON.stringify({
    userId: user.id,
    nonce,
    platform: platformParam,
    ts: Date.now(),
  })

  const encryptedState = safeEncrypt(statePayload)
  if (!encryptedState) {
    const redirectUrl = new URL('/settings', APP_URL)
    redirectUrl.searchParams.set('oauth_error', 'Failed to generate OAuth state. Check ENCRYPTION_SECRET.')
    return NextResponse.redirect(redirectUrl.toString())
  }

  // Base64url-encode the encrypted state so it's URL-safe
  const stateParam = Buffer.from(encryptedState, 'utf-8').toString('base64url')

  const authUrl = buildAuthUrl(platformParam, stateParam)

  return NextResponse.redirect(authUrl)
}
