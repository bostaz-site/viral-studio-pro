/**
 * Meta (Instagram) API tracker — fetches reel stats for a published post.
 *
 * Required OAuth scope: instagram_manage_insights (Business/Creator account)
 * API: Instagram Graph API — GET /{media-id}/insights
 *
 * STATUS: API scope pending approval. This tracker implements the expected
 * contract but will throw if the scope is not yet available.
 */

export interface PostStats {
  views: number
  likes: number
  comments: number
  shares: number
}

/**
 * Fetch stats for an Instagram Reel by its media ID.
 *
 * Requires `instagram_manage_insights` scope on a Business/Creator account.
 *
 * When fully approved, the flow is:
 *   1. GET https://graph.instagram.com/v21.0/{media-id}?fields=like_count,comments_count
 *   2. GET https://graph.instagram.com/v21.0/{media-id}/insights?metric=plays,shares,saved
 */
export async function fetchPostStats(
  accessToken: string,
  platformPostId: string,
): Promise<PostStats> {
  // Step 1: Basic media fields (likes, comments)
  const mediaUrl = `https://graph.instagram.com/v21.0/${encodeURIComponent(platformPostId)}?fields=like_count,comments_count&access_token=${encodeURIComponent(accessToken)}`

  const mediaRes = await fetch(mediaUrl, {
    signal: AbortSignal.timeout(10000),
  })

  if (mediaRes.status === 403 || mediaRes.status === 401) {
    throw new Error('Instagram API not yet approved — instagram_manage_insights scope required')
  }

  if (!mediaRes.ok) {
    const text = await mediaRes.text().catch(() => '')
    throw new Error(`Instagram API ${mediaRes.status}: ${text.slice(0, 200)}`)
  }

  const mediaData = await mediaRes.json()

  // Step 2: Insights (plays, shares, saved) — requires Business account
  let views = 0
  let shares = 0

  try {
    const insightsUrl = `https://graph.instagram.com/v21.0/${encodeURIComponent(platformPostId)}/insights?metric=plays,shares,saved&access_token=${encodeURIComponent(accessToken)}`
    const insightsRes = await fetch(insightsUrl, {
      signal: AbortSignal.timeout(10000),
    })

    if (insightsRes.ok) {
      const insightsData = await insightsRes.json()
      const metrics = insightsData.data ?? []

      for (const m of metrics) {
        if (m.name === 'plays') views = m.values?.[0]?.value ?? 0
        if (m.name === 'shares') shares = m.values?.[0]?.value ?? 0
      }
    }
  } catch {
    // Insights may fail if not a business account — continue with basic data
  }

  return {
    views,
    likes: mediaData.like_count ?? 0,
    comments: mediaData.comments_count ?? 0,
    shares,
  }
}
