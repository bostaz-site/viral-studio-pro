import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/clips/video-url?slug=CLIP_SLUG
 *
 * Uses Twitch's GQL API to resolve direct MP4 video URLs for a clip.
 * Returns the highest quality MP4 URL for use with native <video>.
 */

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql'
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

interface VideoQuality {
  frameRate: number
  quality: string
  sourceURL: string
}

// In-memory cache (persists for serverless function lifetime)
const cache = new Map<string, { url: string; ts: number }>()
const CACHE_TTL = 3600_000 // 1 hour

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug || typeof slug !== 'string' || slug.length > 200) {
    return NextResponse.json(
      { error: 'Missing or invalid slug parameter' },
      { status: 400 }
    )
  }

  // Check cache
  const cached = cache.get(slug)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(
      { video_url: cached.url },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    )
  }

  try {
    // Use Twitch's persisted query `VideoAccessToken_Clip` — it returns both
    // the video qualities AND the playback access token (sig + value) needed
    // to authorize the CloudFront CDN. Without the token, CloudFront returns
    // 401 Unauthorized for all clip MP4 URLs.
    // Only allow alphanumeric, hyphens and underscores in slug (Twitch clip IDs)
    const cleanSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '')
    const gqlResponse = await fetch(TWITCH_GQL_URL, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_PUBLIC_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          operationName: 'VideoAccessToken_Clip',
          variables: { slug: cleanSlug, platform: 'web' },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                '6fd3af2b22989506269b9ac02dd87eb4a6688392d67d94e41a6886f1e9f5c00f',
            },
          },
        },
      ]),
    })

    if (!gqlResponse.ok) {
      return NextResponse.json(
        { error: 'Twitch GQL request failed', status: gqlResponse.status },
        { status: 502 }
      )
    }

    const json = await gqlResponse.json()
    const clipData = Array.isArray(json) ? json[0]?.data?.clip : json?.data?.clip
    const qualities = clipData?.videoQualities as VideoQuality[] | undefined
    const token = clipData?.playbackAccessToken as
      | { signature: string; value: string }
      | undefined

    if (!qualities || qualities.length === 0) {
      return NextResponse.json(
        { error: 'No video qualities found for this clip' },
        { status: 404 }
      )
    }

    // The playback access token is bound to a SPECIFIC clip_uri/quality
    // (usually 720p). Using the token with a mismatched quality (e.g. 1080p)
    // makes CloudFront accept the handshake then stall mid-stream. We must
    // pick the quality whose sourceURL matches the clip_uri inside the token.
    let chosenQuality: VideoQuality | undefined
    let tokenClipUri: string | null = null
    if (token?.value) {
      try {
        const parsed = JSON.parse(token.value) as { clip_uri?: string }
        tokenClipUri = parsed.clip_uri ?? null
      } catch {
        tokenClipUri = null
      }
    }
    if (tokenClipUri) {
      chosenQuality = qualities.find((q) => q.sourceURL === tokenClipUri)
    }
    // Fallback: if no exact match, match by resolution in the URL, else take
    // the quality closest to 720p (which is what Twitch's access token
    // typically authorizes for unauthenticated clip playback).
    if (!chosenQuality) {
      chosenQuality = [...qualities].sort(
        (a, b) =>
          Math.abs(parseInt(a.quality) - 720) -
          Math.abs(parseInt(b.quality) - 720)
      )[0]
    }

    // Append playback access token to authorize CloudFront CDN
    let signedUrl = chosenQuality.sourceURL
    if (token?.signature && token?.value) {
      const sep = signedUrl.includes('?') ? '&' : '?'
      signedUrl = `${signedUrl}${sep}sig=${token.signature}&token=${encodeURIComponent(token.value)}`
    }

    cache.set(slug, { url: signedUrl, ts: Date.now() })

    return NextResponse.json(
      { video_url: signedUrl },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    )
  } catch (err) {
    console.error('[clips/video-url] Error:', err)
    return NextResponse.json(
      { error: 'Failed to resolve clip video URL' },
      { status: 500 }
    )
  }
}
