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
    // Simple GQL query — reliable and returns direct MP4 URLs via CloudFront
    const gqlResponse = await fetch(TWITCH_GQL_URL, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_PUBLIC_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{ clip(slug: "${slug.replace(/"/g, '')}") { videoQualities { frameRate quality sourceURL } } }`,
      }),
    })

    if (!gqlResponse.ok) {
      return NextResponse.json(
        { error: 'Twitch GQL request failed', status: gqlResponse.status },
        { status: 502 }
      )
    }

    const data = await gqlResponse.json()
    const qualities = data?.data?.clip?.videoQualities as VideoQuality[] | undefined

    if (!qualities || qualities.length === 0) {
      return NextResponse.json(
        { error: 'No video qualities found for this clip' },
        { status: 404 }
      )
    }

    // Pick the best quality (highest resolution)
    const best = [...qualities].sort(
      (a, b) => parseInt(b.quality) - parseInt(a.quality)
    )[0]

    cache.set(slug, { url: best.sourceURL, ts: Date.now() })

    return NextResponse.json(
      { video_url: best.sourceURL },
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
