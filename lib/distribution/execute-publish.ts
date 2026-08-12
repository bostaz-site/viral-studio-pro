/**
 * Shared publish execution logic — used by the cron executor.
 * Handles: clip lookup, token refresh, fresh signed URL, TikTok Direct Post, published_posts logging.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from './token-manager'
import { buildSignedExternalUrl } from './external-url'
import { logger } from '@/lib/logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

interface TikTokOptions {
  privacy_level: string
  disable_comment: boolean
  disable_duet: boolean
  disable_stitch: boolean
  brand_content_toggle?: boolean
  brand_organic_toggle?: boolean
}

export interface ExecutePublishParams {
  userId: string
  clipId: string
  platform: string
  caption: string
  hashtags: string[]
  tiktokOptions: TikTokOptions | null
}

export interface ExecutePublishResult {
  success: boolean
  postId: string | null
  error?: string
}

export async function executePublish(params: ExecutePublishParams): Promise<ExecutePublishResult> {
  const { userId, clipId, platform, caption, hashtags, tiktokOptions } = params
  const admin = createAdminClient()

  // 0. Guard: skip if this clip was already published manually (defense in depth)
  const { data: existingPost } = await admin
    .from('published_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('clip_id', clipId)
    .eq('platform', platform)
    .limit(1)

  if (existingPost && existingPost.length > 0) {
    return { success: false, postId: null, error: 'already published manually' }
  }

  // 1. Find clip storage path (render_jobs first, then clips table)
  const { data: renderJobs } = await admin
    .from('render_jobs')
    .select('id, clip_id, storage_path, user_id, render_settings')
    .eq('clip_id', clipId)
    .eq('user_id', userId)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)

  const renderJob = renderJobs?.[0] as {
    id: string; clip_id: string; storage_path: string | null; user_id: string;
    render_settings: Record<string, unknown> | null;
  } | undefined ?? null
  let clipStoragePath: string | null = renderJob?.storage_path ?? null

  if (!clipStoragePath) {
    const { data: clip } = await admin
      .from('clips')
      .select('storage_path')
      .eq('id', clipId)
      .eq('user_id', userId)
      .single()
    clipStoragePath = clip?.storage_path ?? null
  }

  if (!clipStoragePath) {
    return { success: false, postId: null, error: 'Clip not found or not rendered' }
  }

  // 2. Get valid OAuth token (auto-refresh)
  const tokenSet = await getValidToken(userId, platform as 'tiktok' | 'youtube' | 'instagram')
  if (!tokenSet) {
    return { success: false, postId: null, error: `No ${platform} account connected` }
  }

  // 3. Build FRESH signed external URL (never use a stored one)
  let videoUrl: string
  try {
    videoUrl = buildSignedExternalUrl(clipStoragePath, APP_URL)
  } catch (err) {
    return { success: false, postId: null, error: `Failed to build video URL: ${err instanceof Error ? err.message : 'unknown'}` }
  }

  // 4. Build full caption
  const hashtagString = hashtags?.length
    ? '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    : ''
  const fullCaption = caption + hashtagString

  // 5. Publish (TikTok only at launch)
  if (platform !== 'tiktok') {
    return { success: false, postId: null, error: `Platform ${platform} not supported for auto-post` }
  }

  if (!tiktokOptions) {
    return { success: false, postId: null, error: 'TikTok options missing — configure auto-post defaults' }
  }

  try {
    const postInfo: Record<string, unknown> = {
      title: fullCaption.slice(0, 2200),
      privacy_level: tiktokOptions.privacy_level,
      disable_comment: tiktokOptions.disable_comment,
      disable_duet: tiktokOptions.disable_duet,
      disable_stitch: tiktokOptions.disable_stitch,
      video_cover_timestamp_ms: 1000,
    }
    if (tiktokOptions.brand_content_toggle) postInfo.brand_content_toggle = true
    if (tiktokOptions.brand_organic_toggle) postInfo.brand_organic_toggle = true

    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenSet.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
      }),
    })

    const initData = await initRes.json() as {
      data?: { publish_id?: string }
      error?: { code?: string; message?: string }
    }

    if (!initRes.ok || (initData.error?.code && initData.error.code !== 'ok')) {
      const code = initData.error?.code ?? ''
      const msg = initData.error?.message ?? 'Unknown TikTok error'
      return { success: false, postId: null, error: `TikTok: ${msg} (${code}, HTTP ${initRes.status})` }
    }

    const postId = initData.data?.publish_id ?? null

    // 6. Log to published_posts (same as manual publish)
    // MUST be awaited — in serverless (Netlify), fire-and-forget promises
    // are killed when the response is sent, causing silent data loss.
    const publishedAt = new Date().toISOString()
    let niche: string | null = null
    let algoScore: number | null = null
    let sourcePlatform: string | null = null
    let sourceStreamer: string | null = null
    let durationFromSource: number | null = null

    const { data: trendingClip } = await admin
      .from('trending_clips')
      .select('platform, author_name, niche, velocity_score, duration_seconds')
      .eq('id', clipId)
      .single()

    if (trendingClip) {
      sourcePlatform = trendingClip.platform
      sourceStreamer = trendingClip.author_name
      niche = trendingClip.niche
      algoScore = trendingClip.velocity_score
      durationFromSource = trendingClip.duration_seconds
    }

    const { data: socialAccount } = await admin
      .from('social_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single()

    // Auto-resolve render settings from render_jobs snapshot
    const rs = renderJob?.render_settings ?? null

    const { error: insertError } = await admin.from('published_posts').insert({
      user_id: userId,
      clip_id: clipId,
      render_job_id: renderJob?.id ?? null,
      platform,
      account_id: socialAccount?.id ?? null,
      platform_post_id: postId,
      published_at: publishedAt,
      posted_hour_local: new Date().getHours(),
      posted_weekday: new Date().getDay(),
      caption_style: (rs?.caption_style as string | null) ?? null,
      hook_style: (rs?.hook_style as string | null) ?? null,
      hook_enabled: (rs?.hook_enabled as boolean | null) ?? null,
      split_screen_enabled: (rs?.split_screen_enabled as boolean | null) ?? null,
      smart_zoom_mode: (rs?.smart_zoom_mode as string | null) ?? null,
      clip_mood: (rs?.auto_cut_mood as string | null) ?? null,
      algo_score_at_pick: algoScore,
      source_platform: sourcePlatform,
      source_streamer: sourceStreamer,
      niche,
      duration_seconds: durationFromSource,
    })

    if (insertError) {
      logger.error(`[execute-publish] published_posts insert failed: ${insertError.message}`)
    }

    return { success: true, postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Publishing failed'
    logger.error(`[execute-publish] ${platform} failed for user=${userId} clip=${clipId}: ${msg}`)
    return { success: false, postId: null, error: msg }
  }
}
