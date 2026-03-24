const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

export interface TikTokTokens {
  access_token: string
  open_id: string
  expires_in: number
}

export interface TikTokUploadResult {
  publish_id: string
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

export function getTikTokAuthUrl(redirectUri: string, clientKey: string, state: string): string {
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'user.info.basic,video.upload,video.publish',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })
  return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`
}

export async function exchangeTikTokCode(
  code: string,
  redirectUri: string,
  clientKey: string,
  clientSecret: string
): Promise<TikTokTokens> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`TikTok token exchange failed: ${await res.text()}`)
  const json = await res.json() as { data: TikTokTokens }
  return json.data
}

export async function getTikTokUserInfo(accessToken: string): Promise<{ username: string; open_id: string }> {
  const res = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`TikTok user info failed: ${await res.text()}`)
  const json = await res.json() as { data: { user: { open_id: string; display_name: string } } }
  return { username: json.data.user.display_name, open_id: json.data.user.open_id }
}

// ── Publishing ─────────────────────────────────────────────────────────────────

export async function uploadVideoToTikTok(
  accessToken: string,
  videoUrl: string,
  caption: string,
  hashtags: string[]
): Promise<TikTokUploadResult> {
  const fullCaption = `${caption}\n\n${hashtags.slice(0, 20).map((h) => `#${h}`).join(' ')}`

  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: fullCaption.slice(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  })

  if (!res.ok) throw new Error(`TikTok upload failed: ${await res.text()}`)
  const json = await res.json() as { data: { publish_id: string } }
  return { publish_id: json.data.publish_id }
}
