/**
 * YouTube Data API tracker — fetches video stats for a published post.
 *
 * Required OAuth scope: https://www.googleapis.com/auth/youtube.readonly
 * Quota cost: 1 unit per videos.list call.
 */

export interface PostStats {
  views: number
  likes: number
  comments: number
  shares: number
}

/**
 * Fetch stats for a YouTube video/short by its video ID.
 * The accessToken must be a valid YouTube OAuth token with youtube.readonly scope.
 */
export async function fetchPostStats(
  accessToken: string,
  platformPostId: string,
): Promise<PostStats> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(platformPostId)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const item = data.items?.[0]

  if (!item) {
    throw new Error(`YouTube video not found: ${platformPostId}`)
  }

  const stats = item.statistics ?? {}

  return {
    views: parseInt(stats.viewCount ?? '0', 10),
    likes: parseInt(stats.likeCount ?? '0', 10),
    comments: parseInt(stats.commentCount ?? '0', 10),
    // YouTube API doesn't expose shares directly — return 0
    shares: 0,
  }
}
