/**
 * Resolve a Twitch clip (by slug or full URL) to a signed MP4 CloudFront URL
 * that can be downloaded by yt-dlp / FFmpeg / direct fetch.
 *
 * Shared between:
 *   - GET /api/clips/video-url  (live preview in the browser)
 *   - POST /api/render          (VPS needs a real MP4 URL, not a twitch.tv page)
 *
 * Uses Twitch's public GQL persisted query `VideoAccessToken_Clip` to fetch
 * both the video qualities AND the playback access token. The token is bound
 * to a specific clip_uri, so we pick the matching quality — otherwise
 * CloudFront either 401s or stalls mid-stream.
 */

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql'
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'
const PERSISTED_QUERY_HASH =
  '6fd3af2b22989506269b9ac02dd87eb4a6688392d67d94e41a6886f1e9f5c00f'

interface VideoQuality {
  frameRate: number
  quality: string
  sourceURL: string
}

/**
 * Extract the Twitch clip slug from any of the common URL shapes.
 * Returns null if the input is not recognizable as a Twitch clip URL.
 *
 * Supported shapes:
 *   - https://clips.twitch.tv/SLUG
 *   - https://www.twitch.tv/CHANNEL/clip/SLUG
 *   - https://m.twitch.tv/clip/SLUG
 *   - Just the raw slug (no URL)
 */
export function extractTwitchClipSlug(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  // Raw slug — alphanumerics, hyphens, underscores, no slashes/dots
  if (!/[/.:?]/.test(trimmed)) return trimmed.replace(/"/g, '')
  const match = trimmed.match(
    /clips\.twitch\.tv\/([A-Za-z0-9_-]+)|\/clip\/([A-Za-z0-9_-]+)/,
  )
  if (!match) return null
  return (match[1] || match[2] || '').replace(/"/g, '') || null
}

/**
 * Resolve a slug to a playable, signed CloudFront MP4 URL.
 * Throws on any failure (no qualities, GQL error, etc.) so callers can
 * decide whether to fall back to the raw external URL or bail.
 */
export async function resolveTwitchClipMp4Url(slug: string): Promise<string> {
  const cleanSlug = slug.replace(/"/g, '')
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
            sha256Hash: PERSISTED_QUERY_HASH,
          },
        },
      },
    ]),
  })

  if (!gqlResponse.ok) {
    throw new Error(`Twitch GQL request failed: HTTP ${gqlResponse.status}`)
  }

  const json = await gqlResponse.json()
  const clipData = Array.isArray(json) ? json[0]?.data?.clip : json?.data?.clip
  const qualities = clipData?.videoQualities as VideoQuality[] | undefined
  const token = clipData?.playbackAccessToken as
    | { signature: string; value: string }
    | undefined

  if (!qualities || qualities.length === 0) {
    throw new Error('No video qualities returned for clip')
  }

  // The playback access token is bound to a SPECIFIC clip_uri/quality
  // (usually 720p). Using the token with a mismatched quality (e.g. 1080p)
  // makes CloudFront accept the handshake then stall mid-stream. Pick the
  // quality whose sourceURL matches the clip_uri inside the token.
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
  if (!chosenQuality) {
    // Fallback: take the quality closest to 720p (what the token typically
    // authorizes for unauthenticated playback).
    chosenQuality = [...qualities].sort(
      (a, b) =>
        Math.abs(parseInt(a.quality) - 720) -
        Math.abs(parseInt(b.quality) - 720),
    )[0]
  }

  let signedUrl = chosenQuality.sourceURL
  if (token?.signature && token?.value) {
    const sep = signedUrl.includes('?') ? '&' : '?'
    signedUrl = `${signedUrl}${sep}sig=${token.signature}&token=${encodeURIComponent(token.value)}`
  }

  return signedUrl
}

/**
 * Convenience: accepts either a slug, a Twitch clip URL, or null/undefined.
 * Returns a signed MP4 URL, or throws on failure. Callers can catch and
 * fall back to the raw URL if they want.
 */
export async function resolveTwitchClipFromUrlOrSlug(
  input: string | null | undefined,
): Promise<string> {
  if (!input) throw new Error('No input')
  const slug = extractTwitchClipSlug(input)
  if (!slug) {
    throw new Error(`Could not extract Twitch slug from: ${input}`)
  }
  return resolveTwitchClipMp4Url(slug)
}
