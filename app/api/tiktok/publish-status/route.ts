import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getValidToken } from '@/lib/distribution/token-manager'
import type { TikTokPublishStatusResponse } from '@/types/tiktok'

const statusSchema = z.object({
  publish_id: z.string().min(1),
})

/**
 * POST /api/tiktok/publish-status
 *
 * Polls the TikTok publish status via
 * POST /v2/post/publish/status/fetch/
 *
 * Called by the frontend every 5s after initiating a publish.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  const tokenSet = await getValidToken(user.id, 'tiktok')
  if (!tokenSet) {
    return errorResponse('No TikTok account connected.', 400)
  }

  const body = await req.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('publish_id is required', 400)
  }

  try {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenSet.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: parsed.data.publish_id }),
      }
    )

    const json = (await res.json()) as TikTokPublishStatusResponse

    if (!res.ok || (json.error?.code && json.error.code !== 'ok')) {
      return errorResponse(
        `TikTok status check failed: ${json.error?.message ?? 'Unknown error'}`,
        502
      )
    }

    return jsonResponse({
      status: json.data.status,
      fail_reason: json.data.fail_reason ?? null,
      post_id: json.data.publicaly_available_post_id?.[0] ?? null,
    })
  } catch (err) {
    return errorResponse(
      `Failed to check publish status: ${err instanceof Error ? err.message : 'unknown'}`,
      500
    )
  }
})
