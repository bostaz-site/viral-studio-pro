import { NextRequest } from 'next/server'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getValidToken } from '@/lib/distribution/token-manager'
import type { TikTokCreatorInfoResponse, TikTokCreatorInfo } from '@/types/tiktok'

/**
 * GET /api/tiktok/creator-info
 *
 * Fetches the authenticated TikTok creator's info via
 * POST /v2/post/publish/creator_info/query/
 *
 * Required by TikTok Content Sharing Guidelines:
 * - privacy_level_options (for privacy dropdown)
 * - comment_disabled / duet_disabled / stitch_disabled (for interaction toggles)
 * - max_video_post_duration_sec (for pre-submit validation)
 * - creator_nickname (to display in the publish dialog)
 */
export const GET = withAuth(async (_req: NextRequest, user) => {
  const tokenSet = await getValidToken(user.id, 'tiktok')
  if (!tokenSet) {
    return errorResponse(
      'No TikTok account connected. Connect it in Settings first.',
      400
    )
  }

  try {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenSet.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    )

    const json = (await res.json()) as TikTokCreatorInfoResponse

    if (!res.ok || (json.error?.code && json.error.code !== 'ok')) {
      return errorResponse(
        `TikTok creator info failed: ${json.error?.message ?? 'Unknown error'} (code: ${json.error?.code ?? 'none'})`,
        502
      )
    }

    const creatorInfo: TikTokCreatorInfo = {
      creator_avatar_url: json.data.creator_avatar_url,
      creator_nickname: json.data.creator_nickname,
      creator_username: json.data.creator_username,
      privacy_level_options: json.data.privacy_level_options,
      comment_disabled: json.data.comment_disabled,
      duet_disabled: json.data.duet_disabled,
      stitch_disabled: json.data.stitch_disabled,
      max_video_post_duration_sec: json.data.max_video_post_duration_sec,
    }

    return jsonResponse({ creatorInfo })
  } catch (err) {
    return errorResponse(
      `Failed to fetch TikTok creator info: ${err instanceof Error ? err.message : 'unknown'}`,
      500
    )
  }
})
