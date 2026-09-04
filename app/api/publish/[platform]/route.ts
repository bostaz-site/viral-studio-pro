import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatform, PLATFORM_CONFIGS, type Platform } from '@/lib/distribution/platforms'
import { getValidToken } from '@/lib/distribution/token-manager'
import { buildSignedExternalUrl } from '@/lib/distribution/external-url'
import { logger } from '@/lib/logger'
import { notifyPublishSuccess, notifyPublishFailed } from '@/lib/discord/notify'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

const publishSchema = z.object({
  clip_id: z.string().uuid(),
  // Caption can be empty — user adds it on the platform (especially in Inbox mode)
  caption: z.string().max(2200).default(''),
  hashtags: z.array(z.string()).max(30).optional(),
  // TikTok Direct Post options (required by Content Sharing Guidelines)
  tiktok_options: z.object({
    privacy_level: z.enum([
      'PUBLIC_TO_EVERYONE',
      'MUTUAL_FOLLOW_FRIENDS',
      'FOLLOWER_OF_CREATOR',
      'SELF_ONLY',
    ]),
    disable_comment: z.boolean(),
    disable_duet: z.boolean(),
    disable_stitch: z.boolean(),
    brand_content_toggle: z.boolean().optional(),
    brand_organic_toggle: z.boolean().optional(),
  }).optional(),
  // YouTube visibility (default: public)
  youtube_privacy: z.enum(['public', 'unlisted', 'private']).optional(),
  // Optional metadata snapshot for published_posts logging
  metadata: z.object({
    clip_mood: z.string().optional(),
    caption_style: z.string().optional(),
    caption_tone: z.string().optional(),
    hook_style: z.string().optional(),
    hook_enabled: z.boolean().optional(),
    smart_zoom_mode: z.string().optional(),
    duration_seconds: z.number().optional(),
    blowup_chance_at_render: z.number().optional(),
    posted_hour_local: z.number().min(0).max(23).optional(),
    posted_weekday: z.number().min(0).max(6).optional(),
  }).optional(),
})

export const POST = withAuth(
  async (req: NextRequest, user) => {
    const url = new URL(req.url)
    const segments = url.pathname.split('/')
    const platformParam = segments[segments.indexOf('publish') + 1]

    if (!platformParam || !isPlatform(platformParam)) {
      return errorResponse(`Unsupported platform: ${platformParam}`, 400)
    }

    // Hard gate: only active platforms allowed — block even if client state is corrupted.
    // META_PREVIEW_EMAILS can override for instagram/facebook (App Review screencasts).
    const { isComingSoonPlatform } = await import('@/lib/distribution/launch-platforms')
    if (isComingSoonPlatform(platformParam, user.email ?? undefined)) {
      return errorResponse(
        `${PLATFORM_CONFIGS[platformParam].displayName} publishing is coming soon.`,
        403
      )
    }

    const config = PLATFORM_CONFIGS[platformParam]

    // Parse body
    const body = await req.json()
    const parsed = publishSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 400)
    }

    const { clip_id, caption, hashtags, metadata, tiktok_options, youtube_privacy } = parsed.data
    const admin = createAdminClient()

    // Verify clip exists and belongs to user
    // Check render_jobs first (rendered clips from trending_clips or uploaded videos)
    // Use .limit(1) without .single() — multiple done jobs may exist
    // for the same clip (user clicked "Generate" multiple times).
    const { data: renderJobs } = await admin
      .from('render_jobs')
      .select('id, clip_id, storage_path, clip_url, user_id, render_settings, transform_score, status')
      .eq('clip_id', clip_id)
      .eq('user_id', user.id)
      .in('status', ['done', 'degraded'])
      .order('created_at', { ascending: false })
      .limit(1)

    const renderJob = renderJobs?.[0] as {
      id: string; clip_id: string; storage_path: string | null;
      clip_url: string | null; user_id: string;
      render_settings: Record<string, unknown> | null;
      transform_score: number | null; status: string;
    } | undefined ?? null

    // Fallback: check clips table
    let clipStoragePath: string | null = null
    let clipTitle: string | null = null
    let clipAuthorHandle: string | null = null

    if (renderJob?.storage_path) {
      clipStoragePath = renderJob.storage_path

      // Look for a platform-specific variant (cross-platform deduplication).
      // If render_variants table exists and no variant found for non-primary platform → error.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try {
        const { data: variants, error: varErr } = await (admin as any)
          .from('render_variants')
          .select('storage_path, variant_key')
          .eq('render_job_id', renderJob.id)
          .eq('platform', platformParam)
          .limit(1) as { data: Array<{ storage_path: string; variant_key: string }> | null; error: { message: string } | null }

        if (varErr) {
          // Table doesn't exist yet or query failed — log and continue with base render
          logger.warn(`[publish/${platformParam}] render_variants query failed: ${varErr.message}`)
        } else if (variants && variants.length > 0 && variants[0].storage_path) {
          clipStoragePath = variants[0].storage_path
          logger.info(`[publish/${platformParam}] Using variant ${variants[0].variant_key} instead of base render`)
        } else if (platformParam !== 'tiktok') {
          // Non-primary platform with no variant: refuse to publish base render (duplicate risk)
          return errorResponse(
            `No ${PLATFORM_CONFIGS[platformParam].displayName} variant available for this render. Re-render with multi-platform enabled.`,
            400
          )
        }
      } catch (err) {
        // Table truly doesn't exist — log and continue with base render for now
        logger.warn(`[publish/${platformParam}] render_variants check failed: ${err instanceof Error ? err.message : 'unknown'}`)
      }

      // Try to get title from trending_clips or videos
      const { data: trending } = await admin
        .from('trending_clips')
        .select('title, author_handle, author_name')
        .eq('id', clip_id)
        .single()
      if (trending) {
        clipTitle = trending.title
        clipAuthorHandle = trending.author_handle ?? trending.author_name ?? null
      } else {
        const { data: video } = await admin
          .from('videos')
          .select('title')
          .eq('id', clip_id)
          .single()
        clipTitle = video?.title ?? null
      }
    } else {
      // Fallback to clips table
      const { data: clip } = await admin
        .from('clips')
        .select('id, storage_path, title, user_id')
        .eq('id', clip_id)
        .eq('user_id', user.id)
        .single()

      if (!clip) {
        return errorResponse('Clip not found. Make sure you have rendered this clip first.', 404)
      }
      clipStoragePath = clip.storage_path
      clipTitle = clip.title
    }

    if (!clipStoragePath) {
      return errorResponse('Clip has not been rendered yet. Render it first before publishing.', 400)
    }

    // Guard: never publish the same storage_path to two different platforms
    const { data: existingPub } = await admin
      .from('published_posts')
      .select('id, platform')
      .eq('user_id', user.id)
      .eq('clip_id', clip_id)
      .limit(5)

    const sameFileOnOtherPlatform = existingPub?.find(
      p => p.platform !== platformParam
    )
    // If the same BASE storage path was already published elsewhere, check if we have a variant
    // (variant paths differ, so this guard only fires if the exact same file would be reused)
    if (sameFileOnOtherPlatform && renderJob?.storage_path === clipStoragePath) {
      logger.warn(`[publish/${platformParam}] Clip ${clip_id} base render already published to ${sameFileOnOtherPlatform.platform} — no variant available, proceeding with base (dedup gap)`)
    }

    // Get valid token (auto-refreshes if expired)
    const tokenSet = await getValidToken(user.id, platformParam)
    if (!tokenSet) {
      return errorResponse(
        `No ${config.displayName} account connected. Connect it in Settings first.`,
        400
      )
    }

    // For Facebook: fetch page_id + page_access_token from platform_metadata
    let fbPageMeta: { page_id: string; page_access_token: string } | null = null
    if (platformParam === 'facebook') {
      const { data: socialAcct } = await (admin
        .from('social_accounts')
        .select('platform_metadata')
        .eq('user_id', user.id)
        .eq('platform', 'facebook')
        .limit(1)
        .single() as unknown as Promise<{ data: { platform_metadata: Record<string, string> | null } | null }>)

      const meta = socialAcct?.platform_metadata
      if (!meta?.page_id || !meta?.page_access_token) {
        return errorResponse(
          'No Facebook Page configured. Please reconnect Facebook in Settings.',
          400
        )
      }
      const { safeDecrypt } = await import('@/lib/crypto')
      const pageToken = safeDecrypt(meta.page_access_token)
      if (!pageToken) {
        return errorResponse('Failed to decrypt Facebook page token. Please reconnect.', 500)
      }
      fbPageMeta = { page_id: meta.page_id, page_access_token: pageToken }
    }

    // Build a signed external URL served VIA viralanimal.com domain.
    // TikTok requires PULL_FROM_URL videos to originate from a verified
    // domain — viralanimal.com is ours; supabase.co is not.
    // The /api/clips/external route streams the video from Supabase Storage
    // after verifying the HMAC signature on the URL.
    let videoUrl: string
    try {
      videoUrl = buildSignedExternalUrl(clipStoragePath, APP_URL)
    } catch (err) {
      return errorResponse(
        `Failed to build external video URL: ${err instanceof Error ? err.message : 'unknown'}`,
        500
      )
    }

    // P4 · Caption diversification: if this clip was already published with the
    // exact same caption (other platform/account/time), request a Haiku variant.
    // Fail-open — falls back to the original caption. Seeded by clip+platform+day.
    let finalCaption = caption
    let finalHashtags: string[] = hashtags ?? []
    try {
      const rsForKw = renderJob?.render_settings as Record<string, unknown> | null
      const nicheKeyword = typeof rsForKw?.niche_keyword === 'string' ? (rsForKw.niche_keyword as string) : null
      const { diversifyCaptionIfDuplicate } = await import('@/lib/distribution/caption-diversifier')
      const div = await diversifyCaptionIfDuplicate({
        admin,
        clipId: clip_id,
        caption,
        hashtags: finalHashtags,
        seed: `${clip_id}:${platformParam}:${new Date().toISOString().slice(0, 13)}`,
        nicheKeyword,
        streamerHandle: clipAuthorHandle,
        platform: platformParam,
      })
      if (div.diversified) {
        finalCaption = div.caption
        finalHashtags = div.hashtags
        logger.info(`[publish/${platformParam}] caption diversified for clip ${clip_id} (${div.reason})`)
      }
    } catch (divErr) {
      logger.warn(`[publish/${platformParam}] caption diversification skipped: ${divErr instanceof Error ? divErr.message : String(divErr)}`)
    }

    // Build full caption with hashtags
    const hashtagString = finalHashtags.length
      ? '\n\n' + finalHashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : ''
    const fullCaption = finalCaption + hashtagString

    // Create publication record (status: publishing)
    const { data: publication, error: pubError } = await admin
      .from('publications')
      .insert({
        clip_id,
        social_account_id: null, // We'll update after finding the account
        platform: platformParam,
        caption: finalCaption,
        hashtags: finalHashtags,
        status: 'publishing',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (pubError || !publication) {
      return errorResponse(`Failed to create publication record: ${pubError?.message}`, 500)
    }

    // Get social account ID for the publication record
    const { data: socialAccount } = await admin
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', platformParam)
      .single()

    if (socialAccount) {
      await admin
        .from('publications')
        .update({ social_account_id: socialAccount.id })
        .eq('id', publication.id)
    }

    // Publish to platform
    try {
      const result = await publishToPlatform(
        platformParam,
        tokenSet.accessToken,
        videoUrl,
        fullCaption,
        clipTitle ?? 'Viral Animal Clip',
        tiktok_options,
        fbPageMeta,
        youtube_privacy,
      )

      // Instagram async: container created, client must poll /api/publish/status
      if (result.mode === 'processing' && result.igContainerId) {
        await admin
          .from('publications')
          .update({
            status: 'processing',
            platform_post_id: result.igContainerId,
          } as never)
          .eq('id', publication.id)

        return jsonResponse({
          publicationId: publication.id,
          platform: platformParam,
          status: 'processing',
          containerId: result.igContainerId,
          igUserId: result.igUserId,
        })
      }

      // Synchronous publish (TikTok, YouTube, Facebook) — update immediately
      const publishedAt = new Date().toISOString()
      await admin
        .from('publications')
        .update({
          status: 'published',
          platform_post_id: result.postId ?? null,
          tracking_url: result.trackingUrl ?? null,
          published_at: publishedAt,
        })
        .eq('id', publication.id)

      // Log to published_posts for Learning Engine pattern detection.
      // Auto-resolve from render_settings (persisted at render time) when caller doesn't send metadata.
      const rs = renderJob?.render_settings as Record<string, unknown> | null

      // Fetch source metadata from trending_clips if available
      let sourcePlatform: string | null = null
      let sourceStreamer: string | null = null
      let niche: string | null = null
      let algoScore: number | null = null
      let durationFromSource: number | null = null

      const { data: trendingClip } = await admin
        .from('trending_clips')
        .select('platform, author_name, niche, velocity_score, duration_seconds')
        .eq('id', clip_id)
        .single()

      if (trendingClip) {
        sourcePlatform = trendingClip.platform
        sourceStreamer = trendingClip.author_name
        niche = trendingClip.niche
        algoScore = trendingClip.velocity_score
        durationFromSource = trendingClip.duration_seconds
      }

      // MUST be awaited — in serverless (Netlify), fire-and-forget promises
      // are killed when the response is sent, causing silent data loss.
      const { error: ppError } = await admin
        .from('published_posts')
        .insert({
          user_id: user.id,
          clip_id,
          render_job_id: renderJob?.id ?? null,
          platform: platformParam,
          account_id: socialAccount?.id ?? null,
          account_handle: null,
          platform_post_id: result.postId ?? null,
          published_at: publishedAt,
          posted_hour_local: metadata?.posted_hour_local ?? new Date().getHours(),
          posted_weekday: metadata?.posted_weekday ?? new Date().getDay(),
          // Render settings: caller metadata wins, then render_settings snapshot, then null
          caption_style: metadata?.caption_style ?? (rs?.caption_style as string | null) ?? null,
          caption_tone: metadata?.caption_tone ?? null,
          hook_style: metadata?.hook_style ?? (rs?.hook_style as string | null) ?? null,
          hook_enabled: metadata?.hook_enabled ?? (rs?.hook_enabled as boolean | null) ?? null,
          smart_zoom_mode: metadata?.smart_zoom_mode ?? (rs?.smart_zoom_mode as string | null) ?? null,
          clip_mood: metadata?.clip_mood ?? (rs?.auto_cut_mood as string | null) ?? null,
          duration_seconds: metadata?.duration_seconds ?? durationFromSource ?? null,
          blowup_chance_at_render: metadata?.blowup_chance_at_render ?? null,
          algo_score_at_pick: algoScore,
          source_platform: sourcePlatform,
          source_streamer: sourceStreamer,
          niche,
        })

      if (ppError) {
        logger.error(`[publish] published_posts insert failed: ${ppError.message}`)
      }

      void notifyPublishSuccess({
        platform: platformParam,
        mode: 'manual',
        clipTitle: clipTitle,
      }).catch(() => {})

      // Transform score warning for manual publish (autofarm blocks <3, manual warns <3)
      const transformWarning = renderJob && renderJob.transform_score !== null && renderJob.transform_score < 3
        ? `Ce render a ${renderJob.transform_score}/3 transformations — risque de visibilité réduite sur TikTok`
        : null

      return jsonResponse({
        publicationId: publication.id,
        platform: platformParam,
        postId: result.postId,
        publishId: result.postId,
        trackingUrl: result.trackingUrl,
        mode: result.mode ?? 'direct',
        status: 'published',
        transformWarning,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Publishing failed'
      logger.error(`[publish] ${platformParam} failed for user=${user.id} clip=${clip_id}: ${errMsg}`)

      void notifyPublishFailed({
        platform: platformParam,
        reason: errMsg,
        userId: user.id,
        mode: 'manual',
      }).catch(() => {})

      // Update publication record with error
      await admin
        .from('publications')
        .update({
          status: 'error',
        })
        .eq('id', publication.id)

      return errorResponse(errMsg, 500)
    }
  }
)

// ── Platform-specific publish logic ────────────────────────────────────────────

interface PublishResult {
  postId: string | null
  trackingUrl: string | null
  mode?: 'direct' | 'inbox' | 'processing'
  igContainerId?: string
  igUserId?: string
}

interface TikTokOptions {
  privacy_level: string
  disable_comment: boolean
  disable_duet: boolean
  disable_stitch: boolean
  brand_content_toggle?: boolean
  brand_organic_toggle?: boolean
}

interface FacebookPageMeta {
  page_id: string
  page_access_token: string
}

async function publishToPlatform(
  platform: Platform,
  accessToken: string,
  videoUrl: string,
  caption: string,
  title: string,
  tiktokOptions?: TikTokOptions,
  facebookPageMeta?: FacebookPageMeta | null,
  youtubePrivacy?: 'public' | 'unlisted' | 'private',
): Promise<PublishResult> {
  switch (platform) {
    case 'tiktok':
      return publishToTikTok(accessToken, videoUrl, caption, tiktokOptions)
    case 'youtube':
      return publishToYouTube(accessToken, videoUrl, caption, title, youtubePrivacy)
    case 'instagram':
      // Instagram Login flow: uses the user's IG token directly with graph.instagram.com
      return publishToInstagram(accessToken, videoUrl, caption)
    case 'facebook':
      if (!facebookPageMeta) throw new Error('Facebook Page metadata missing')
      return publishToFacebook(facebookPageMeta, videoUrl, caption)
    default:
      throw new Error(`Publishing not supported for platform: ${platform}`)
  }
}

// ── TikTok Publish ─────────────────────────────────────────────────────────────
//
// Two modes available depending on TikTok app audit status:
//
// 1. INBOX (default, no audit required): Posts as DRAFT to user's TikTok inbox.
//    User opens TikTok app → Drafts → finalizes the post manually.
//    Endpoint: /v2/post/publish/inbox/video/init/
//
// 2. DIRECT POST (requires Direct Post API audit approval):
//    Publishes directly live with full control over caption/privacy/etc.
//    Endpoint: /v2/post/publish/video/init/
//
// Switch between modes via env var TIKTOK_DIRECT_POST_ENABLED=true (after audit).
async function publishToTikTok(
  accessToken: string,
  videoUrl: string,
  caption: string,
  tiktokOptions?: TikTokOptions
): Promise<PublishResult> {
  // Always use Direct Post when tiktokOptions are provided (the dialog
  // collects all required fields). Falls back to inbox mode only when
  // the caller omits tiktokOptions (legacy/non-dialog flow).
  if (tiktokOptions) {
    // Direct Post (requires audit approval)
    // Uses creator-selected privacy, interaction toggles, and commercial content
    // as required by TikTok Content Sharing Developer Guidelines.
    const postInfo: Record<string, unknown> = {
      title: caption.slice(0, 2200),
      privacy_level: tiktokOptions.privacy_level,
      disable_comment: tiktokOptions.disable_comment,
      disable_duet: tiktokOptions.disable_duet,
      disable_stitch: tiktokOptions.disable_stitch,
      video_cover_timestamp_ms: 1000,
    }

    // Commercial content disclosure (only include if toggled on)
    if (tiktokOptions.brand_content_toggle) {
      postInfo.brand_content_toggle = true
    }
    if (tiktokOptions.brand_organic_toggle) {
      postInfo.brand_organic_toggle = true
    }

    const initRes = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: postInfo,
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        }),
      }
    )

    const initData = await initRes.json() as {
      data?: { publish_id?: string }
      error?: { code?: string; message?: string; log_id?: string }
    }

    logger.info('[TikTok Direct Post] Response:', JSON.stringify({ status: initRes.status, body: initData }))

    if (!initRes.ok || (initData.error?.code && initData.error.code !== 'ok')) {
      // If Direct Post is rejected (scope not approved yet), fall back to inbox mode
      const code = initData.error?.code ?? ''
      const isPermissionError = code === 'access_denied' || code === 'scope_not_authorized'
        || code === 'spam_risk_too_many_posts' || code === 'unaudited_client_can_only_post_to_private_accounts'
        || initRes.status === 403
      if (!isPermissionError) {
        throw new Error(
          `TikTok Direct Post failed: ${initData.error?.message ?? 'Unknown error'} ` +
          `(code: ${code || 'none'}, http: ${initRes.status})`
        )
      }
      logger.error('[TikTok] Direct Post rejected, falling back to inbox mode:', code)
      // Fall through to inbox mode below
    } else {
      return {
        postId: initData.data?.publish_id ?? null,
        trackingUrl: null,
        mode: 'direct',
      }
    }
  }

  // Inbox mode (default — no audit required, posts as draft)
  const initRes = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    }
  )

  const initData = await initRes.json() as {
    data?: { publish_id?: string }
    error?: { code?: string; message?: string; log_id?: string }
  }

  logger.info('[TikTok Inbox] Response:', JSON.stringify({ status: initRes.status, body: initData }))

  if (!initRes.ok || (initData.error?.code && initData.error.code !== 'ok')) {
    const code = initData.error?.code ?? ''
    // Rate limit / spam protection — treat as soft success since earlier
    // posts may still be processing. Don't throw — return inbox mode.
    if (code === 'spam_risk_too_many_pending_share' || code === 'rate_limit_exceeded') {
      return {
        postId: null,
        trackingUrl: null,
        mode: 'inbox',
      }
    }
    throw new Error(
      `TikTok upload failed: ${initData.error?.message ?? 'Unknown error'} ` +
      `(code: ${code || 'none'}, http: ${initRes.status})`
    )
  }

  return {
    postId: initData.data?.publish_id ?? null,
    trackingUrl: null,
    mode: 'inbox',
  }
}

// ── YouTube Resumable Upload ───────────────────────────────────────────────────

async function publishToYouTube(
  accessToken: string,
  videoUrl: string,
  caption: string,
  title: string,
  privacyStatus?: 'public' | 'unlisted' | 'private',
): Promise<PublishResult> {
  // Step 1: Download the video from signed URL
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    throw new Error('Failed to download clip for YouTube upload')
  }

  const videoBuffer = await videoRes.arrayBuffer()
  const videoBytes = new Uint8Array(videoBuffer)
  const contentLength = videoBytes.length

  // Step 2: Start resumable upload
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: caption,
      categoryId: '24', // Entertainment
      tags: ['shorts', 'viral', 'clips'],
    },
    status: {
      privacyStatus: privacyStatus ?? 'public',
      selfDeclaredMadeForKids: false,
    },
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': contentLength.toString(),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!initRes.ok) {
    const errorBody = await initRes.text()
    throw new Error(`YouTube upload init failed: ${errorBody}`)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('YouTube did not return an upload URL')
  }

  // Step 3: Upload the video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': contentLength.toString(),
    },
    body: videoBytes,
  })

  const uploadData = await uploadRes.json() as {
    id?: string
    error?: { message?: string; errors?: Array<{ message?: string }> }
  }

  if (!uploadRes.ok || !uploadData.id) {
    const errMsg =
      uploadData.error?.errors?.[0]?.message ??
      uploadData.error?.message ??
      'Upload failed'
    throw new Error(`YouTube upload failed: ${errMsg}`)
  }

  return {
    postId: uploadData.id,
    trackingUrl: `https://youtube.com/watch?v=${uploadData.id}`,
  }
}

// ── Instagram Reels Publish (Instagram Login flow) ──────────────────────────
//
// Uses the Instagram API with Instagram Login (graph.instagram.com).
// Three-step container flow:
// 1. GET /me → resolve IG user ID
// 2. POST /{ig_user_id}/media → creates container
// 3. Poll /{container_id}?fields=status_code until FINISHED (5 min, backoff)
// 4. POST /{ig_user_id}/media_publish → publishes the container
//
// Requirements:
// - Instagram Business or Creator account
// - Token with instagram_business_content_publish scope
// - Video URL publicly accessible, 9:16, 3-90s, H.264/HEVC
// - Caption <= 2200 chars

async function publishToInstagram(
  accessToken: string,
  videoUrl: string,
  caption: string,
): Promise<PublishResult> {
  const BASE = 'https://graph.instagram.com/v21.0'

  // Resolve IG user ID from token
  const meRes = await fetch(`${BASE}/me?fields=user_id&access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(8000) })
  const meData = await meRes.json() as { user_id?: string; id?: string; error?: { message?: string } }
  const igUserId = meData.user_id ?? meData.id
  if (!igUserId) {
    throw new Error(`Instagram /me failed: ${meData.error?.message ?? 'Could not resolve user ID'}`)
  }

  // Create Reel container — returns immediately. Polling + final publish
  // happen via GET /api/publish/status (client-driven, one check per call).
  const containerRes = await fetch(`${BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption.slice(0, 2200),
      share_to_feed: true,
      access_token: accessToken,
    }),
    signal: AbortSignal.timeout(8000),
  })
  const containerData = await containerRes.json() as {
    id?: string
    error?: { message?: string; code?: number }
  }
  if (!containerRes.ok || !containerData.id) {
    throw new Error(
      `Instagram container creation failed: ${containerData.error?.message ?? 'Unknown error'}`
    )
  }

  // Return processing — client will poll /api/publish/status to finalize
  return {
    postId: null,
    trackingUrl: null,
    mode: 'processing' as 'direct',
    igContainerId: containerData.id,
    igUserId,
  }
}

// ── Facebook Page Video Publish ─────────────────────────────────────────────
//
// Simple one-step upload via file_url. Sufficient for pages_manage_posts review.
// Full Reels 3-phase upload can be added later.

async function publishToFacebook(
  pageMeta: FacebookPageMeta,
  videoUrl: string,
  caption: string,
): Promise<PublishResult> {
  const { page_id, page_access_token } = pageMeta

  // Facebook downloads the video server-side and responds quickly (< 5s typically).
  // Timeout at 8s to stay within Netlify's ~10s function limit.
  const res = await fetch(`https://graph.facebook.com/v25.0/${page_id}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_url: videoUrl,
      description: caption.slice(0, 2200),
      access_token: page_access_token,
    }),
    signal: AbortSignal.timeout(8000),
  })

  const data = await res.json() as {
    id?: string
    error?: { message?: string; code?: number }
  }

  if (!res.ok || !data.id) {
    throw new Error(`Facebook video upload failed: ${data.error?.message ?? 'Unknown error'}`)
  }

  return {
    postId: data.id,
    trackingUrl: `https://www.facebook.com/${page_id}/videos/${data.id}`,
  }
}
