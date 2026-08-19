/**
 * Token management: refresh, expiry checks, DB updates.
 *
 * Tokens are stored encrypted in the social_accounts table.
 * This module handles decryption for use, refresh when expired,
 * and re-encryption before updating the DB.
 *
 * Distributed mutex via Upstash Redis:
 * Before refreshing, acquires `SET lock:token:{platform}:{userId} 1 NX EX 30`.
 * If lock is held by another isolate, waits 2s then re-reads the freshly
 * refreshed token from DB.
 *
 * On refresh failure (revoked/expired refresh_token), marks the account
 * as disconnected (disconnected_at + disconnect_reason) so the UI can
 * prompt the user to reconnect.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { safeEncrypt, safeDecrypt } from '@/lib/crypto'
import { redis } from '@/lib/upstash'
import { type Platform, PLATFORM_CONFIGS, getClientCredentials } from './platforms'
import { logger } from '@/lib/logger'

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
  disconnected_at: string | null
  platform_metadata: Record<string, unknown> | null
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
 * Returns null if no account is connected OR if the account is disconnected
 * (refresh_token revoked — user needs to reconnect).
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

  // Account was marked disconnected (refresh failed previously) — user must reconnect
  if (row.disconnected_at) return null

  // Check if token needs refresh
  if (isTokenExpired(row.token_expires_at)) {
    const lockKey = `lock:token:${platform}:${userId}`

    let lockAcquired = false
    try {
      // Try to acquire distributed lock (30s TTL)
      const result = await redis.set(lockKey, '1', { nx: true, ex: 30 })
      lockAcquired = result === 'OK'
    } catch {
      // Redis down — proceed without lock (best-effort)
      lockAcquired = true
    }

    if (!lockAcquired) {
      // Another isolate is refreshing — wait 2s then read the fresh token
      await new Promise(r => setTimeout(r, 2000))
      const { data: freshRow } = await admin
        .from('social_accounts')
        .select('access_token, refresh_token, token_expires_at, disconnected_at')
        .eq('id', row.id)
        .single()

      if (!freshRow) return null

      // If the other isolate marked it disconnected, bail
      const freshAny = freshRow as unknown as Record<string, unknown>
      if (freshAny.disconnected_at) return null

      if (!isTokenExpired(freshAny.token_expires_at as string | null)) {
        return {
          accessToken: safeDecrypt(freshAny.access_token as string)!,
          refreshToken: safeDecrypt(freshAny.refresh_token as string | null),
          expiresAt: freshAny.token_expires_at ? new Date(freshAny.token_expires_at as string) : null,
        }
      }
      // Other isolate failed or took too long — fall through to refresh ourselves
    }

    try {
      const decryptedRefresh = safeDecrypt(row.refresh_token)
      if (!decryptedRefresh) {
        // No refresh token → mark disconnected
        const reason = `${PLATFORM_CONFIGS[platform].displayName} token expired and no refresh token available.`
        await markDisconnected(admin, row.id, reason, userId, platform)
        return null
      }

      const refreshed = await refreshToken(platform, decryptedRefresh)

      // Update DB with new tokens
      const updateData: Record<string, string | null> = {
        access_token: safeEncrypt(refreshed.accessToken)!,
        token_expires_at: refreshed.expiresAt?.toISOString() ?? null,
      }
      if (refreshed.refreshToken) {
        updateData.refresh_token = safeEncrypt(refreshed.refreshToken)
      }

      // Backfill username if it's still a placeholder
      if (platform === 'tiktok' && (!row.username || row.username === 'tiktok_user')) {
        const realUsername = await fetchTikTokUsername(refreshed.accessToken)
        if (realUsername && realUsername !== 'tiktok_user') {
          updateData.username = realUsername
        }
      }

      await admin
        .from('social_accounts')
        .update(updateData)
        .eq('id', row.id)

      return refreshed
    } catch (err) {
      // Refresh failed → mark account as disconnected
      const errMsg = err instanceof Error ? err.message : 'Unknown refresh error'
      logger.error(`[token-manager] ${platform} refresh failed for user=${userId}: ${errMsg}`)

      await markDisconnected(admin, row.id, errMsg, userId, platform)
      return null
    } finally {
      // Always release the lock
      if (lockAcquired) {
        try { await redis.del(lockKey) } catch { /* best-effort cleanup */ }
      }
    }
  }

  return {
    accessToken: safeDecrypt(row.access_token)!,
    refreshToken: safeDecrypt(row.refresh_token),
    expiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
  }
}

/**
 * Mark a social account as disconnected (token refresh failed).
 * The user must reconnect via OAuth to restore it.
 */
async function markDisconnected(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  reason: string,
  userId?: string,
  platform?: string,
) {
  await admin
    .from('social_accounts')
    .update({
      disconnected_at: new Date().toISOString(),
      disconnect_reason: reason.slice(0, 500),
    } as never)
    .eq('id', accountId)

  if (userId && platform) {
    const { notifyAccountDisconnected } = await import('@/lib/discord/notify')
    void notifyAccountDisconnected({ platform, userId, reason }).catch(() => {})
  }
}

/**
 * Fetch the real TikTok username/display_name for backfilling.
 */
async function fetchTikTokUsername(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name,username',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json() as {
      data?: { user?: { display_name?: string; username?: string } }
    }
    return data.data?.user?.username ?? data.data?.user?.display_name ?? null
  } catch {
    return null
  }
}

/**
 * Proactively refresh all tokens expiring within `withinHours` hours.
 * Used by the refresh-oauth-tokens cron.
 * Returns a summary of results.
 */
export async function refreshExpiringTokens(withinHours: number = 12): Promise<{
  refreshed: number
  failed: number
  skipped: number
  details: Array<{ accountId: string; platform: string; status: string; error?: string }>
}> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() + withinHours * 3600 * 1000).toISOString()

  // Find all non-disconnected accounts with tokens expiring within the window
  const { data: accounts, error } = await admin
    .from('social_accounts')
    .select('*')
    .is('disconnected_at', null)
    .not('refresh_token', 'is', null)
    .not('token_expires_at', 'is', null)
    .lt('token_expires_at', cutoff)

  if (error || !accounts || accounts.length === 0) {
    return { refreshed: 0, failed: 0, skipped: 0, details: [] }
  }

  let refreshed = 0
  let failed = 0
  let skipped = 0
  const details: Array<{ accountId: string; platform: string; status: string; error?: string }> = []

  for (const raw of accounts) {
    const row = raw as unknown as SocialAccountRow

    // Use getValidToken which handles locking + refresh + disconnect marking
    const result = await getValidToken(row.user_id, row.platform as Platform)

    if (result) {
      refreshed++
      details.push({ accountId: row.id, platform: row.platform, status: 'refreshed' })
    } else {
      // Check if it was marked disconnected by the refresh attempt
      const { data: check } = await admin
        .from('social_accounts')
        .select('disconnected_at')
        .eq('id', row.id)
        .single()

      if ((check as unknown as { disconnected_at: string | null } | null)?.disconnected_at) {
        failed++
        details.push({
          accountId: row.id,
          platform: row.platform,
          status: 'failed',
          error: 'Refresh token revoked or expired — account marked disconnected',
        })
      } else {
        skipped++
        details.push({ accountId: row.id, platform: row.platform, status: 'skipped' })
      }
    }
  }

  return { refreshed, failed, skipped, details }
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

  // Fetch user info — get real username, not placeholder
  const username = await fetchTikTokUsername(data.access_token) ?? 'tiktok_user'

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

  // Step 3: Get Facebook user info (IG business account resolved in OAuth callback)
  let platformUserId = ''
  let username = 'instagram_user'
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(longLivedToken)}`
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
