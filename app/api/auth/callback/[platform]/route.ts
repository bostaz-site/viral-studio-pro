/**
 * OAuth callback handler at /api/auth/callback/[platform]
 *
 * This is the redirect URI registered with TikTok, YouTube, and Instagram.
 * Delegates to the same logic as /api/oauth/[platform]/callback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeDecrypt, safeEncrypt } from '@/lib/crypto'
import { isPlatform } from '@/lib/distribution/platforms'
import { exchangeCodeForTokens } from '@/lib/distribution/token-manager'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

interface OAuthState {
  userId: string
  nonce: string
  platform: string
  ts: number
}

function redirectWithError(message: string): NextResponse {
  const redirectUrl = new URL('/settings', APP_URL)
  redirectUrl.searchParams.set('oauth_error', message)
  return NextResponse.redirect(redirectUrl.toString())
}

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platformParam = params.platform

  if (!platformParam || !isPlatform(platformParam)) {
    return redirectWithError(`Unsupported platform: ${platformParam}`)
  }

  const url = new URL(req.url)

  // Check for error from provider
  const errorParam = url.searchParams.get('error')
  if (errorParam) {
    const errorDesc = url.searchParams.get('error_description') ?? errorParam
    return redirectWithError(errorDesc)
  }

  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')

  if (!code) {
    return redirectWithError('Missing authorization code')
  }

  if (!stateParam) {
    return redirectWithError('Missing OAuth state parameter')
  }

  // Validate state
  let state: OAuthState
  try {
    const decoded = Buffer.from(stateParam, 'base64url').toString('utf-8')
    const decrypted = safeDecrypt(decoded)
    if (!decrypted) {
      return redirectWithError('Invalid OAuth state')
    }
    state = JSON.parse(decrypted) as OAuthState
  } catch {
    return redirectWithError('Invalid or tampered OAuth state')
  }

  // Verify state matches platform
  if (state.platform !== platformParam) {
    return redirectWithError('OAuth state platform mismatch')
  }

  // Verify state is not too old (10 min max)
  if (Date.now() - state.ts > 10 * 60 * 1000) {
    return redirectWithError('OAuth state expired. Please try again.')
  }

  // Verify the user is still authenticated
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== state.userId) {
    return redirectWithError('Authentication mismatch. Please log in and try again.')
  }

  // Exchange code for tokens
  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(platformParam, code)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token exchange failed'
    return redirectWithError(msg)
  }

  // Encrypt tokens before storing
  const encryptedAccess = safeEncrypt(tokens.accessToken)
  const encryptedRefresh = safeEncrypt(tokens.refreshToken)

  // Upsert social account
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('social_accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('platform', platformParam)
    .single()

  if (existing) {
    const { error: updateError } = await admin
      .from('social_accounts')
      .update({
        platform_user_id: tokens.platformUserId,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        token_expires_at: tokens.expiresAt?.toISOString() ?? null,
        username: tokens.username,
        connected_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      return redirectWithError(`Failed to update account: ${updateError.message}`)
    }
  } else {
    const { error: insertError } = await admin
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform: platformParam,
        platform_user_id: tokens.platformUserId,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        token_expires_at: tokens.expiresAt?.toISOString() ?? null,
        username: tokens.username,
        connected_at: new Date().toISOString(),
      })

    if (insertError) {
      return redirectWithError(`Failed to save account: ${insertError.message}`)
    }
  }

  // Redirect to settings with success
  const redirectUrl = new URL('/settings', APP_URL)
  redirectUrl.searchParams.set('connected', platformParam)
  return NextResponse.redirect(redirectUrl.toString())
}
