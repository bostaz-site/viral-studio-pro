/**
 * Token management: refresh, expiry checks, DB updates.
 *
 * Tokens are stored encrypted in the social_accounts table.
 * This module handles decryption for use, refresh when expired,
 * and re-encryption before updating the DB.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { safeEncrypt, safeDecrypt } from '@/lib/crypto'
import { type Platform, PLATFORM_CONFIGS, getClientCredentials } from './platforms'

interface TokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}

interface SocialAccountRow {
  id: string
  user_id: string
  platform: string
  platform_user_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  username: string | null
  connected_at: string
}

/**
 * Check if a token is expired or about to expire (5 min buffer).
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false // No expiry = long-lived token
  const expiry = new Date(expiresAt)
  const buffer = 5 * 60 * 1000 // 5 minutes
  return Date.now() >= expiry.getTime() - buffer
}

/**
 * Get a valid access token for a user+platform.
 * Refreshes automatically if expired.
 * Returns null if no account is connected.
 */
export async function getValidToken(
  userId: string,
  platform: Platform
): Promise<TokenSet | null> {
  const admin = createAdminClient()

  const { data: account, error } = await admin
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()

  if (error || !account) return null

  const row = account as unknown as SocialAccountRow

  // Check if token needs refresh
  if (isTokenExpired(row.token_expires_at)) {
    const decryptedRefresh = safeDecrypt(row.refresh_token)
    if (!decryptedRefresh) {
      // No refresh token — user must reconnect
      throw new Error(
        `${PLATFORM_CONFIGS[platform].displayName} token expired and no refresh token available. ` +
        'Please reconnect your account.'
      )
    }

    const refreshed = await refreshToken(platform, decryptedRefresh)

    // Update DB with new tokens
    const updateData: Record<string, string | null> = {
      access_token: safeEncrypt(refreshed.accessToken)!,
      token_expires_at: refreshed.expiresAt?.toISOString() ?? null,
    }
    // Some platforms rotate refresh tokens
    if (refreshed.refreshToken) {
      updateData.refresh_token = safeEncrypt(refreshed.refreshToken)
    }

    await admin
      .from('social_accounts')
      .update(updateData)
      .eq('id', row.id)

    return refreshed
  }

  return {
    accessToken: safeDecrypt(row.access_token)!,
    refreshToken: safeDecrypt(row.refresh_token),
    expiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
  }
}

/**
 * Refresh an access token using the platform-specific refresh flow.
 */
async function refreshToken(
  platform: Platform,
  refreshTokenValue: string
): Promise<TokenSet> {
  switch (platform) {
    case 'tiktok':
      return refreshTikTokToken(refreshTokenValue)
    case 'youtube':
      return refreshYouTubeToken(refreshTokenValue)
    case 'instagram':
      return refreshInstagramToken(refreshTokenValue)
    default:
      throw new Error(`Token refresh not supported for platform: ${platform}`)
  }
}

// ── TikTok ─────────────────────────────────────────────────────────────────────

async function refreshTikTokToken(refreshTokenValue: string): Promise<TokenSet> {
  const { clientId, clientSecret } = getClientCredentials('tiktok')
  const config = PLATFORM_CONFIGS.tiktok

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
    }),
  })

  const data = await res.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `TikTok token refresh failed: ${data.error_description ?? data.error ?? 'Unknown error'}`
    )
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshTokenValue,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  }
}

// ── YouTube (Google) ───────────────────────────────────────────────────────────

async function refreshYouTubeToken(refreshTokenValue: string): Promise<TokenSet> {
  const { clientId, clientSecret } = getClientCredentials('youtube')
  const config = PLATFORM_CONFIGS.youtube

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
    }),
  })

  const data = await res.json() as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `YouTube token refresh failed: ${data.error_description ?? data.error ?? 'Unknown error'}`
    )
  }

  return {
    accessToken: data.access_token,
    refreshToken: refreshTokenValue, // Google doesn't rotate refresh tokens
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  }
}

// ── Instagram (Meta/Facebook) ──────────────────────────────────────────────────

async function refreshInstagramToken(refreshTokenValue: string): Promise<TokenSet> {
  // Instagram long-lived tokens can be refreshed via:
  // GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?` +
    `grant_type=ig_refresh_token&access_token=${encodeURIComponent(refreshTokenValue)}`,
    { method: 'GET' }
  )

  const data = await res.json() as {
    access_token?: string
    expires_in?: number
    error?: { message?: string }
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Instagram token refresh failed: ${data.error?.message ?? 'Unknown error'}`
    )
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.access_token, // IG uses the access token itself for refresh
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  }
}

/**
 * Exchange an authorization code for tokens.
 * Each platform has a different token exchange flow.
 */
export async function exchangeCodeForTokens(
  platform: Platform,
  code: string
): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  platformUserId: string
  username: string
}> {
  switch (platform) {
    case 'tiktok':
      return exchangeTikTokCode(code)
    case 'youtube':
      return exchangeYouTubeCode(code)
    case 'instagram':
      return exchangeInstagramCode(code)
    default:
      throw new Error(`Code exchange not supported for platform: ${platform}`)
  }
}

// ── TikTok Code Exchange ───────────────────────────────────────────────────────

async function exchangeTikTokCode(code: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  platformUserId: string
  username: string
}> {
  const { clientId, clientSecret } = getClientCredentials('tiktok')
  const config = PLATFORM_CONFIGS.tiktok

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  })

  const data = await res.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    open_id?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `TikTok code exchange failed: ${data.error_description ?? data.error ?? 'Unknown error'}`
    )
  }

  // Fetch user info
  let username = 'tiktok_user'
  try {
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name,username',
      {
        headers: { Authorization: `Bearer ${data.access_token}` },
      }
    )
    const userData = await userRes.json() as {
      data?: { user?: { display_name?: string; username?: string } }
    }
    username = userData.data?.user?.username ?? userData.data?.user?.display_name ?? 'tiktok_user'
  } catch {
    // Non-fatal: keep default username
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    platformUserId: data.open_id ?? '',
    username,
  }
}

// ── YouTube Code Exchange ──────────────────────────────────────────────────────

async function exchangeYouTubeCode(code: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  platformUserId: string
  username: string
}> {
  const { clientId, clientSecret } = getClientCredentials('youtube')
  const config = PLATFORM_CONFIGS.youtube

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  })

  const data = await res.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `YouTube code exchange failed: ${data.error_description ?? data.error ?? 'Unknown error'}`
    )
  }

  // Fetch channel info
  let channelId = ''
  let channelTitle = 'youtube_user'
  try {
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: { Authorization: `Bearer ${data.access_token}` },
      }
    )
    const channelData = await channelRes.json() as {
      items?: Array<{ id?: string; snippet?: { title?: string } }>
    }
    if (channelData.items?.[0]) {
      channelId = channelData.items[0].id ?? ''
      channelTitle = channelData.items[0].snippet?.title ?? 'youtube_user'
    }
  } catch {
    // Non-fatal
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    platformUserId: channelId,
    username: channelTitle,
  }
}

// ── Instagram Code Exchange ────────────────────────────────────────────────────

async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  platformUserId: string
  username: string
}> {
  const { clientId, clientSecret } = getClientCredentials('instagram')
  const config = PLATFORM_CONFIGS.instagram

  // Step 1: Exchange code for short-lived token
  // Facebook Graph API uses GET with query params for token exchange
  const tokenUrl = new URL(config.tokenUrl)
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('redirect_uri', config.redirectUri)
  tokenUrl.searchParams.set('grant_type', 'authorization_code')

  const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' })
  const tokenData = await tokenRes.json() as {
    access_token?: string
    error?: { message?: string }
  }

  if (!tokenRes.ok || !tokenData.access_token) {
    // If using Facebook Login flow, try POST
    const postRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const postData = await postRes.json() as {
      access_token?: string
      error?: { message?: string }
    }

    if (!postRes.ok || !postData.access_token) {
      throw new Error(
        `Instagram code exchange failed: ${postData.error?.message ?? tokenData.error?.message ?? 'Unknown error'}`
      )
    }

    tokenData.access_token = postData.access_token
  }

  const shortLivedToken = tokenData.access_token!

  // Step 2: Exchange for long-lived token
  let longLivedToken = shortLivedToken
  let expiresAt: Date | null = null
  try {
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${clientId}` +
      `&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`,
      { method: 'GET' }
    )
    const longData = await longRes.json() as {
      access_token?: string
      expires_in?: number
    }
    if (longData.access_token) {
      longLivedToken = longData.access_token
      expiresAt = longData.expires_in
        ? new Date(Date.now() + longData.expires_in * 1000)
        : null
    }
  } catch {
    // Keep short-lived token
  }

  // Step 3: Get user info
  let platformUserId = ''
  let username = 'instagram_user'
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${longLivedToken}`
    )
    const meData = await meRes.json() as { id?: string; name?: string }
    platformUserId = meData.id ?? ''
    username = meData.name ?? 'instagram_user'
  } catch {
    // Non-fatal
  }

  return {
    accessToken: longLivedToken,
    refreshToken: longLivedToken, // FB uses the token itself for refresh
    expiresAt,
    platformUserId,
    username,
  }
}
