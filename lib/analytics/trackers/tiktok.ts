/**
 * TikTok API tracker — fetches video stats for a published post.
 *
 * Required OAuth scope: video.list
 * API: https://developers.tiktok.com/doc/content-posting-api-get-video-status
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
 * Fetch stats for a TikTok video by its publish_id or video_id.
 *
 * Requires `video.list` scope. TikTok's Content Posting API returns
 * status + basic metrics via GET /v2/post/publish/status/fetch/.
 *
 * When fully approved, the flow is:
 *   1. POST https://open.tiktokapis.com/v2/video/query/ with video IDs
 *   2. Response includes view_count, like_count, comment_count, share_count
 */
export async function fetchPostStats(
  accessToken: string,
  platformPostId: string,
): Promise<PostStats> {
  // TikTok Video Query API
  const url = 'https://open.tiktokapis.com/v2/video/query/'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: {
        video_ids: [platformPostId],
      },
      fields: ['id', 'view_count', 'like_count', 'comment_count', 'share_count'],
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (res.status === 403 || res.status === 401) {
    throw new Error('TikTok API not yet approved — video.list scope required')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`TikTok API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const video = data.data?.videos?.[0]

  if (!video) {
    throw new Error(`TikTok video not found: ${platformPostId}`)
  }

  return {
    views: video.view_count ?? 0,
    likes: video.like_count ?? 0,
    comments: video.comment_count ?? 0,
    shares: video.share_count ?? 0,
  }
}
