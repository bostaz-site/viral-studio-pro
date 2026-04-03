const IG_API_BASE = 'https://graph.instagram.com/v18.0'

export interface InstagramTokens {
  access_token: string
  user_id: string
}

export interface InstagramUploadResult {
  id: string
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

export function getInstagramAuthUrl(redirectUri: string, appId: string, state: string): string {
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights',
    response_type: 'code',
    state,
  })
  return `https://api.instagram.com/oauth/authorize?${params.toString()}`
}

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<InstagramTokens> {
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  })
  if (!res.ok) throw new Error(`Instagram token exchange failed: ${await res.text()}`)
  return res.json() as Promise<InstagramTokens>
}

export async function getInstagramUserInfo(
  accessToken: string,
  userId: string
): Promise<{ username: string }> {
  const res = await fetch(
    `${IG_API_BASE}/${userId}?fields=username&access_token=${accessToken}`
  )
  if (!res.ok) throw new Error(`Instagram user info failed: ${await res.text()}`)
  return res.json() as Promise<{ username: string }>
}

// ── Publishing ─────────────────────────────────────────────────────────────────

export async function uploadReelToInstagram(
  accessToken: string,
  userId: string,
  videoUrl: string,
  caption: string,
  hashtags: string[]
): Promise<InstagramUploadResult> {
  const fullCaption = `${caption}\n\n${hashtags.slice(0, 30).map((h) => `#${h}`).join(' ')}`

  // Step 1: Create media container
  const containerRes = await fetch(`${IG_API_BASE}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: fullCaption,
      share_to_feed: true,
      access_token: accessToken,
    }),
  })
  if (!containerRes.ok) {
    throw new Error(`Instagram container creation failed: ${await containerRes.text()}`)
  }
  const { id: containerId } = await containerRes.json() as { id: string }

  // Step 2: Poll until container is FINISHED
  let attempts = 0
  while (attempts < 12) {
    await new Promise((r) => setTimeout(r, 5000))
    const statusRes = await fetch(
      `${IG_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const status = await statusRes.json() as { status_code: string }
    if (status.status_code === 'FINISHED') break
    if (status.status_code === 'ERROR') throw new Error('Instagram video processing failed')
    attempts++
  }

  // Step 3: Publish
  const publishRes = await fetch(`${IG_API_BASE}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  })
  if (!publishRes.ok) throw new Error(`Instagram publish failed: ${await publishRes.text()}`)
  return publishRes.json() as Promise<InstagramUploadResult>
}
