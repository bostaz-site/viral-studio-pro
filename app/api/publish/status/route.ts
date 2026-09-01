import { NextRequest } from 'next/server'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/distribution/token-manager'
import { logger } from '@/lib/logger'

/**
 * GET /api/publish/status?publicationId=xxx
 *
 * Lightweight poll endpoint for async publishing (Instagram Reels).
 * Each call does ONE status check and publishes when FINISHED.
 * Client polls every 5s (same pattern as render status polling).
 *
 * Returns:
 *   { status: 'processing' }           — still processing
 *   { status: 'published', postId }    — finalized
 *   { status: 'error', error }         — failed
 */
export const GET = withAuth(async (req: NextRequest, user) => {
  const publicationId = req.nextUrl.searchParams.get('publicationId')
  if (!publicationId) {
    return errorResponse('publicationId query param required', 400)
  }

  const admin = createAdminClient()

  // Fetch publication record
  const { data: pub } = await admin
    .from('publications')
    .select('id, platform, status, platform_post_id, clip_id')
    .eq('id', publicationId)
    .single()

  if (!pub) {
    return errorResponse('Publication not found', 404)
  }

  // Already finalized
  if (pub.status === 'published') {
    return jsonResponse({ status: 'published', postId: pub.platform_post_id })
  }
  if (pub.status === 'error') {
    return jsonResponse({ status: 'error', error: 'Publishing failed' })
  }

  // Only Instagram uses async processing currently
  if (pub.platform !== 'instagram' || pub.status !== 'processing') {
    return jsonResponse({ status: pub.status })
  }

  const containerId = pub.platform_post_id // stored as container ID during processing
  if (!containerId) {
    return errorResponse('No container ID found on publication', 500)
  }

  // Get fresh token
  const tokenSet = await getValidToken(user.id, 'instagram')
  if (!tokenSet) {
    return errorResponse('Instagram account not connected', 400)
  }

  const BASE = 'https://graph.instagram.com/v21.0'

  // One status check
  try {
    const statusRes = await fetch(
      `${BASE}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(tokenSet.accessToken)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    const statusData = await statusRes.json() as {
      status_code?: string
      status?: string
      error?: { message?: string }
    }

    if (statusData.status_code === 'ERROR') {
      await admin
        .from('publications')
        .update({ status: 'error' })
        .eq('id', publicationId)
      return jsonResponse({
        status: 'error',
        error: `Instagram processing failed: ${statusData.status ?? 'unknown'}`,
      })
    }

    if (statusData.status_code !== 'FINISHED') {
      return jsonResponse({ status: 'processing', igStatus: statusData.status_code })
    }

    // FINISHED — resolve IG user ID and publish
    const meRes = await fetch(
      `${BASE}/me?fields=user_id&access_token=${encodeURIComponent(tokenSet.accessToken)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    const meData = await meRes.json() as { user_id?: string; id?: string }
    const igUserId = meData.user_id ?? meData.id
    if (!igUserId) {
      return jsonResponse({ status: 'error', error: 'Could not resolve IG user ID' })
    }

    const publishRes = await fetch(`${BASE}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: tokenSet.accessToken,
      }),
      signal: AbortSignal.timeout(8000),
    })
    const publishData = await publishRes.json() as {
      id?: string
      error?: { message?: string }
    }

    if (!publishRes.ok || !publishData.id) {
      const errMsg = publishData.error?.message ?? 'Publish call failed'
      await admin
        .from('publications')
        .update({ status: 'error' })
        .eq('id', publicationId)
      return jsonResponse({ status: 'error', error: errMsg })
    }

    // Success — update publication
    const publishedAt = new Date().toISOString()
    await admin
      .from('publications')
      .update({
        status: 'published',
        platform_post_id: publishData.id,
        published_at: publishedAt,
      })
      .eq('id', publicationId)

    // Insert published_posts row
    try {
      await admin
        .from('published_posts')
        .insert({
          user_id: user.id,
          clip_id: pub.clip_id,
          platform: 'instagram',
          platform_post_id: publishData.id,
          published_at: publishedAt,
          posted_hour_local: new Date().getHours(),
          posted_weekday: new Date().getDay(),
        } as never)
    } catch (e) {
      logger.error(`[publish/status] published_posts insert failed: ${(e as Error).message}`)
    }

    return jsonResponse({ status: 'published', postId: publishData.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Status check failed'
    logger.error(`[publish/status] Instagram poll error: ${msg}`)
    // Don't mark as error on transient failures — client will retry
    return jsonResponse({ status: 'processing', error: msg })
  }
})
