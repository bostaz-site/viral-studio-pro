const YT_API_BASE = 'https://www.googleapis.com/youtube/v3'
const YT_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'

export interface YouTubeTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface YouTubeUploadResult {
  id: string
  url: string
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

export function getYouTubeAuthUrl(redirectUri: string, clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ].join(' '),
    access_type: 'offline',
    state,
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeYouTubeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<YouTubeTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${await res.text()}`)
  return res.json() as Promise<YouTubeTokens>
}

export async function getYouTubeChannelInfo(
  accessToken: string
): Promise<{ username: string; channel_id: string }> {
  const res = await fetch(`${YT_API_BASE}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`YouTube channel info failed: ${await res.text()}`)
  const data = await res.json() as {
    items: Array<{ id: string; snippet: { title: string } }>
  }
  const channel = data.items?.[0]
  if (!channel) throw new Error('No YouTube channel found')
  return { username: channel.snippet.title, channel_id: channel.id }
}

// ── Publishing ─────────────────────────────────────────────────────────────────

export async function uploadVideoToYouTube(
  accessToken: string,
  videoUrl: string,
  title: string,
  description: string,
  hashtags: string[]
): Promise<YouTubeUploadResult> {
  // Fetch video bytes
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error('Failed to fetch video for YouTube upload')
  const videoBuffer = await videoRes.arrayBuffer()

  // Ensure Shorts compatibility: add #Shorts tag and hashtag in title if not present
  const shortsTitle = title.slice(0, 95).includes('#Shorts')
    ? title.slice(0, 100)
    : `${title.slice(0, 92)} #Shorts`

  const allHashtags = ['Shorts', ...hashtags].filter((h, i, a) => a.indexOf(h) === i).slice(0, 15)
  const fullDescription = `${description}\n\n${allHashtags.map((h) => `#${h}`).join(' ')}`

  const metadata = {
    snippet: {
      title: shortsTitle,
      description: fullDescription,
      tags: allHashtags,
      categoryId: '22', // People & Blogs — best fit for Shorts
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  }

  // Step 1 — Initiate resumable upload session
  const initRes = await fetch(
    `${YT_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.byteLength),
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!initRes.ok) throw new Error(`YouTube resumable init failed: ${await initRes.text()}`)

  const uploadUri = initRes.headers.get('Location')
  if (!uploadUri) throw new Error('YouTube did not return upload URI')

  // Step 2 — Upload video bytes to the resumable URI
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  })

  if (!uploadRes.ok) throw new Error(`YouTube upload failed: ${await uploadRes.text()}`)
  const data = await uploadRes.json() as { id: string }
  return { id: data.id, url: `https://youtube.com/shorts/${data.id}` }
}
