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
  returnTo?: string | null
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

  // Build platform_metadata (Instagram stores account_type, Facebook stores page info)
  const rawMeta = (tokens as Record<string, unknown>).platformMetadata as Record<string, unknown> | undefined
  let platformMetadata: Record<string, unknown> | null = null
  if (rawMeta) {
    platformMetadata = { ...rawMeta }
    // Encrypt page_access_token if present (Facebook)
    if (typeof platformMetadata.page_access_token === 'string') {
      platformMetadata.page_access_token = safeEncrypt(platformMetadata.page_access_token as string)
    }
  }

  // Upsert social account
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('social_accounts')
    .select('id, platform_user_id, username')
    .eq('user_id', user.id)
    .eq('platform', platformParam)
    .single()

  if (existing) {
    // Detect account switch (different platform user ID)
    const oldPlatformUserId = (existing as unknown as { platform_user_id: string | null }).platform_user_id
    if (oldPlatformUserId && tokens.platformUserId && oldPlatformUserId !== tokens.platformUserId) {
      console.log(`[oauth] TIKTOK ACCOUNT SWITCHED: user=${user.id} old_id=${oldPlatformUserId} new_id=${tokens.platformUserId} old_username=${(existing as unknown as { username: string | null }).username} new_username=${tokens.username}`)
      try {
        await admin
          .from('published_posts')
          .update({ notes: `orphaned: account switched from ${oldPlatformUserId}` } as never)
          .eq('user_id', user.id)
          .eq('platform', platformParam)
      } catch { /* best-effort */ }
    }

    const updatePayload: Record<string, unknown> = {
      platform_user_id: tokens.platformUserId,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      token_expires_at: tokens.expiresAt?.toISOString() ?? null,
      username: tokens.username,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      disconnect_reason: null,
    }
    if (platformMetadata) updatePayload.platform_metadata = platformMetadata

    const { error: updateError } = await admin
      .from('social_accounts')
      .update(updatePayload)
      .eq('id', existing.id)

    if (updateError) {
      return redirectWithError(`Failed to update account: ${updateError.message}`)
    }
  } else {
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      platform: platformParam,
      platform_user_id: tokens.platformUserId,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      token_expires_at: tokens.expiresAt?.toISOString() ?? null,
      username: tokens.username,
      connected_at: new Date().toISOString(),
    }
    if (platformMetadata) insertPayload.platform_metadata = platformMetadata

    const { error: insertError } = await admin
      .from('social_accounts')
      .insert(insertPayload as never)

    if (insertError) {
      return redirectWithError(`Failed to save account: ${insertError.message}`)
    }
  }

  // Redirect to returnTo (if provided in OAuth state) or settings
  if (state.returnTo && state.returnTo.startsWith('/')) {
    return NextResponse.redirect(new URL(state.returnTo, APP_URL).toString())
  }
  const redirectUrl = new URL('/settings', APP_URL)
  redirectUrl.searchParams.set('connected', platformParam)
  return NextResponse.redirect(redirectUrl.toString())
}
