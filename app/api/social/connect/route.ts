import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTikTokAuthUrl } from '@/lib/social/tiktok'
import { getInstagramAuthUrl } from '@/lib/social/instagram'
import { getYouTubeAuthUrl } from '@/lib/social/youtube'

const PLATFORMS = ['tiktok', 'instagram', 'youtube'] as const
type Platform = (typeof PLATFORMS)[number]

function randomState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Non autorisé' },
      { status: 401 }
    )
  }

  const platform = req.nextUrl.searchParams.get('platform') as Platform | null
  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { data: null, error: 'Invalid platform', message: 'Plateforme invalide' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/social/callback`
  const state = randomState()

  let authUrl: string
  switch (platform) {
    case 'tiktok':
      authUrl = getTikTokAuthUrl(
        redirectUri,
        process.env.TIKTOK_CLIENT_KEY ?? 'tiktok_placeholder',
        state
      )
      break
    case 'instagram':
      authUrl = getInstagramAuthUrl(
        redirectUri,
        process.env.INSTAGRAM_APP_ID ?? 'instagram_placeholder',
        state
      )
      break
    case 'youtube':
      authUrl = getYouTubeAuthUrl(
        redirectUri,
        process.env.YOUTUBE_CLIENT_ID ?? 'youtube_placeholder',
        state
      )
      break
  }

  // Store platform + state in a short-lived cookie so the callback can identify the platform
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('oauth_platform', platform, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
  })
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })
  return response
}
