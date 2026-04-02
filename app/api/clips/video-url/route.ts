import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/clips/video-url?slug=CLIP_SLUG
 *
 * Uses Twitch's internal GQL API to resolve direct MP4 video URLs
 * for a clip. Returns the highest quality MP4 URL that can be used
 * with a native <video> element (no controls, clean autoplay).
 *
 * The GQL endpoint uses a public Client-ID (same one the Twitch
 * web player uses) — no OAuth token needed.
 */

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql'
// Public Client-ID used by Twitch's own web player
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

interface VideoQuality {
  frameRate: number
  quality: string
  sourceURL: string
}

interface ClipGQLResponse {
  data?: {
    clip?: {
      videoQualities?: VideoQuality[]
    }
  }
}

// Simple in-memory cache (survives for the lifetime of the serverless function)
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
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  try {
    const gqlResponse = await fetch(TWITCH_GQL_URL, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_PUBLIC_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          operationName: 'VideoAccessToken_Clip',
          variables: { slug },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                '36b89d2507fce29a94f6571ef77f5e5153a36cdeee4f7f37890f52d8a7fa3bfd',
            },
          },
        },
      ]),
    })

    if (!gqlResponse.ok) {
      // Fallback: try the simple query format
      const fallbackResponse = await fetch(TWITCH_GQL_URL, {
        method: 'POST',
        headers: {
          'Client-ID': TWITCH_PUBLIC_CLIENT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{ clip(slug: "${slug}") { videoQualities { frameRate quality sourceURL } } }`,
        }),
      })

      if (!fallbackResponse.ok) {
        return NextResponse.json(
          { error: 'Twitch GQL request failed' },
          { status: 502 }
        )
      }

      const fallbackData = (await fallbackResponse.json()) as ClipGQLResponse
      const qualities = fallbackData?.data?.clip?.videoQualities

      if (!qualities || qualities.length === 0) {
        return NextResponse.json(
          { error: 'No video qualities found for this clip' },
          { status: 404 }
        )
      }

      // Pick the best quality (highest number)
      const best = qualities.sort(
        (a, b) => parseInt(b.quality) - parseInt(a.quality)
      )[0]

      cache.set(slug, { url: best.sourceURL, ts: Date.now() })

      return NextResponse.json(
        { video_url: best.sourceURL },
        {
          headers: {
            'Cache-Control': 'public, max-age=3600',
          },
        }
      )
    }

    // The persisted query returns an array
    const data = await gqlResponse.json()
    const clipData = Array.isArray(data) ? data[0] : data
    const qualities = clipData?.data?.clip?.videoQualities as
      | VideoQuality[]
      | undefined

    if (!qualities || qualities.length === 0) {
      return NextResponse.json(
        { error: 'No video qualities found for this clip' },
        { status: 404 }
      )
    }

    // Pick the best quality (highest number = best)
    const best = qualities.sort(
      (a, b) => parseInt(b.quality) - parseInt(a.quality)
    )[0]

    cache.set(slug, { url: best.sourceURL, ts: Date.now() })

    return NextResponse.json(
      { video_url: best.sourceURL },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    )
  } catch (err) {
    console.error('[clips/video-url] Error:', err)
    return NextResponse.json(
      { error: 'Failed to resolve clip video URL' },
      { status: 500 }
    )
  }
}
