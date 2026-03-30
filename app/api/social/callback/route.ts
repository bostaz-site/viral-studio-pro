import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeTikTokCode, getTikTokUserInfo } from '@/lib/social/tiktok'
import { exchangeInstagramCode, getInstagramUserInfo } from '@/lib/social/instagram'
import { exchangeYouTubeCode, getYouTubeChannelInfo } from '@/lib/social/youtube'
import { safeEncrypt } from '@/lib/crypto'
import { withAuth } from '@/lib/api/withAuth'

export const GET = withAuth(async (req, user) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectBase = `${appUrl}/publish`

  // Read cookies set during connect
  const platform = req.cookies.get('oauth_platform')?.value
  const storedState = req.cookies.get('oauth_state')?.value

  const code = req.nextUrl.searchParams.get('code')
  const returnedState = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`)
  }

  if (!code || !platform) {
    return NextResponse.redirect(`${redirectBase}?error=missing_params`)
  }

  // Validate platform against allowed list
  const allowedPlatforms = ['tiktok', 'instagram', 'youtube']
  if (!allowedPlatforms.includes(platform)) {
    return NextResponse.redirect(`${redirectBase}?error=unknown_platform`)
  }

  // Validate CSRF state — REQUIRE both values to prevent bypass
  if (!storedState || !returnedState || storedState !== returnedState) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_state`)
  }

  const admin = createAdminClient()
  const redirectUri = `${appUrl}/api/social/callback`

  try {
    let accessToken = ''
    let refreshToken: string | null = null
    let expiresAt: string | null = null
    let username = ''
    let platformUserId = ''

    switch (platform) {
      case 'tiktok': {
        const tokens = await exchangeTikTokCode(
          code,
          redirectUri,
          process.env.TIKTOK_CLIENT_KEY ?? '',
          process.env.TIKTOK_CLIENT_SECRET ?? ''
        )
        accessToken = tokens.access_token
        platformUserId = tokens.open_id
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        const info = await getTikTokUserInfo(accessToken)
        username = info.username
        break
      }
      case 'instagram': {
        const tokens = await exchangeInstagramCode(
          code,
          redirectUri,
          process.env.INSTAGRAM_APP_ID ?? '',
          process.env.INSTAGRAM_APP_SECRET ?? ''
        )
        accessToken = tokens.access_token
        platformUserId = tokens.user_id
        const info = await getInstagramUserInfo(accessToken, platformUserId)
        username = info.username
        break
      }
      case 'youtube': {
        const tokens = await exchangeYouTubeCode(
          code,
          redirectUri,
          process.env.YOUTUBE_CLIENT_ID ?? '',
          process.env.YOUTUBE_CLIENT_SECRET ?? ''
        )
        accessToken = tokens.access_token
        refreshToken = tokens.refresh_token
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        const info = await getYouTubeChannelInfo(accessToken)
        username = info.username
        platformUserId = info.channel_id
        break
      }
      default:
        return NextResponse.redirect(`${redirectBase}?error=unknown_platform`)
    }

    // Upsert social_account — encrypt tokens before storage
    await admin.from('social_accounts').upsert(
      {
        user_id: user.id,
        platform,
        platform_user_id: platformUserId,
        access_token: safeEncrypt(accessToken),
        refresh_token: safeEncrypt(refreshToken),
        token_expires_at: expiresAt,
        username,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' }
    )

    const response = NextResponse.redirect(
      `${redirectBase}?connected=${encodeURIComponent(platform)}`
    )
    // Clear cookies
    response.cookies.delete('oauth_platform')
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'OAuth callback failed'
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(errorMsg)}`
    )
  }
})
