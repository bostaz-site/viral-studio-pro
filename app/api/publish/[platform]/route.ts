import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatform, PLATFORM_CONFIGS, type Platform } from '@/lib/distribution/platforms'
import { getValidToken } from '@/lib/distribution/token-manager'
import { buildSignedExternalUrl } from '@/lib/distribution/external-url'
import { logger } from '@/lib/logger'

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
    const { LAUNCH_ACTIVE_PLATFORMS: activePlatforms } = await import('@/lib/distribution/launch-platforms')
    if (!activePlatforms.includes(platformParam as 'tiktok')) {
      return errorResponse(
        `${PLATFORM_CONFIGS[platformParam].displayName} publishing is coming soon. Only TikTok is available right now.`,
        403
      )
    }

    const config = PLATFORM_CONFIGS[platformParam]

    // Instagram requires platform_metadata (IG Business Account ID + page token)
    // which is resolved during OAuth callback.

    // Parse body
    const body = await req.json()
    const parsed = publishSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 400)
    }

    const { clip_id, caption, hashtags, metadata, tiktok_options } = parsed.data
    const admin = createAdminClient()

    // Verify clip exists and belongs to user
    // Check render_jobs first (rendered clips from trending_clips or uploaded videos)
    // Use .limit(1) without .single() — multiple done jobs may exist
    // for the same clip (user clicked "Generate" multiple times).
    const { data: renderJobs } = await admin
      .from('render_jobs')
      .select('id, clip_id, storage_path, clip_url, user_id, render_settings')
      .eq('clip_id', clip_id)
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)

    const renderJob = renderJobs?.[0] as {
      id: string; clip_id: string; storage_path: string | null;
      clip_url: string | null; user_id: string;
      render_settings: Record<string, unknown> | null;
    } | undefined ?? null

    // Fallback: check clips table
    let clipStoragePath: string | null = null
    let clipTitle: string | null = null

    if (renderJob?.storage_path) {
      clipStoragePath = renderJob.storage_path
      // Try to get title from trending_clips or videos
      const { data: trending } = await admin
        .from('trending_clips')
        .select('title')
        .eq('id', clip_id)
        .single()
      if (trending) {
        clipTitle = trending.title
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

    // Get valid token (auto-refreshes if expired)
    const tokenSet = await getValidToken(user.id, platformParam)
    if (!tokenSet) {
      return errorResponse(
        `No ${config.displayName} account connected. Connect it in Settings first.`,
        400
      )
    }

    // For Instagram: fetch platform_metadata (IG Business Account ID + page token)
    let igMetadata: { ig_business_account_id: string; page_access_token: string } | null = null
    if (platformParam === 'instagram') {
      const { data: socialAcct } = await (admin
        .from('social_accounts')
        .select('platform_metadata')
        .eq('user_id', user.id)
        .eq('platform', 'instagram')
        .limit(1)
        .single() as unknown as Promise<{ data: { platform_metadata: Record<string, string> | null } | null }>)

      const meta = socialAcct?.platform_metadata
      if (!meta?.ig_business_account_id || !meta?.page_access_token) {
        return errorResponse(
          'Instagram Business account not fully configured. Please reconnect Instagram in Settings.',
          400
        )
      }
      // Decrypt the page access token
      const { safeDecrypt } = await import('@/lib/crypto')
      const pageToken = safeDecrypt(meta.page_access_token)
      if (!pageToken) {
        return errorResponse('Failed to decrypt Instagram page token. Please reconnect.', 500)
      }
      igMetadata = { ig_business_account_id: meta.ig_business_account_id, page_access_token: pageToken }
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

    // Build full caption with hashtags
    const hashtagString = hashtags?.length
      ? '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : ''
    const fullCaption = caption + hashtagString

    // Create publication record (status: publishing)
    const { data: publication, error: pubError } = await admin
      .from('publications')
      .insert({
        clip_id,
        social_account_id: null, // We'll update after finding the account
        platform: platformParam,
        caption,
        hashtags: hashtags ?? [],
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
        igMetadata,
      )

      // Update publication record with success
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

      return jsonResponse({
        publicationId: publication.id,
        platform: platformParam,
        postId: result.postId,
        publishId: result.postId,
        trackingUrl: result.trackingUrl,
        mode: result.mode ?? 'direct',
        status: 'published',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Publishing failed'
      logger.error(`[publish] ${platformParam} failed for user=${user.id} clip=${clip_id}: ${errMsg}`)

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
  mode?: 'direct' | 'inbox'
}

interface TikTokOptions {
  privacy_level: string
  disable_comment: boolean
  disable_duet: boolean
  disable_stitch: boolean
  brand_content_toggle?: boolean
  brand_organic_toggle?: boolean
}

interface InstagramMeta {
  ig_business_account_id: string
  page_access_token: string
}

async function publishToPlatform(
  platform: Platform,
  accessToken: string,
  videoUrl: string,
  caption: string,
  title: string,
  tiktokOptions?: TikTokOptions,
  instagramMeta?: InstagramMeta | null,
): Promise<PublishResult> {
  switch (platform) {
    case 'tiktok':
      return publishToTikTok(accessToken, videoUrl, caption, tiktokOptions)
    case 'youtube':
      return publishToYouTube(accessToken, videoUrl, caption, title)
    case 'instagram':
      if (!instagramMeta) throw new Error('Instagram metadata missing')
      return publishToInstagram(instagramMeta, videoUrl, caption)
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

    logger.error('[TikTok Direct Post] Response:', JSON.stringify({ status: initRes.status, body: initData }))

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

  logger.error('[TikTok Inbox] Response:', JSON.stringify({ status: initRes.status, body: initData }))

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
  title: string
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
      privacyStatus: 'private', // Start as private — user can change on YouTube
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

// ── Instagram Reels Publish ──────────────────────────────────────────────────
//
// Two-step container flow as required by Meta Graph API v21.0:
// 1. POST /{ig-user-id}/media → creates container (returns id)
// 2. Poll /{container_id}?fields=status_code until FINISHED
// 3. POST /{ig-user-id}/media_publish → publishes the container
//
// Requirements per Meta docs:
// - Instagram BUSINESS account (Creator accounts NOT supported)
// - Video URL must be publicly accessible to Meta's fetcher
// - Reels: 9:16 aspect ratio, 3-90 seconds, H.264 or HEVC
// - Caption <= 2200 chars
// - Page access token required (NOT user access token)
//
// Required scope: instagram_content_publish
// See: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/content-publishing

async function publishToInstagram(
  igMeta: InstagramMeta,
  videoUrl: string,
  caption: string,
): Promise<PublishResult> {
  const { ig_business_account_id: igUserId, page_access_token: pageToken } = igMeta

  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption.slice(0, 2200),
        share_to_feed: true,
        access_token: pageToken,
      }),
    }
  )

  const containerData = await containerRes.json() as {
    id?: string
    error?: { message?: string; code?: number }
  }

  if (!containerRes.ok || !containerData.id) {
    throw new Error(
      `Instagram container creation failed: ${containerData.error?.message ?? 'Unknown error'}`
    )
  }

  const containerId = containerData.id

  // Step 2: Poll container status until FINISHED (max 60s)
  const maxWait = 60_000
  const pollInterval = 3_000
  const start = Date.now()

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval))

    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(pageToken)}`
    )
    const statusData = await statusRes.json() as {
      status_code?: string
      status?: string
      error?: { message?: string }
    }

    if (statusData.status_code === 'FINISHED') break
    if (statusData.status_code === 'ERROR') {
      throw new Error(`Instagram container processing failed: ${statusData.status ?? 'unknown'}`)
    }
    // IN_PROGRESS — keep polling
  }

  // Step 3: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: pageToken,
      }),
    }
  )

  const publishData = await publishRes.json() as {
    id?: string
    error?: { message?: string }
  }

  if (!publishRes.ok || !publishData.id) {
    throw new Error(
      `Instagram publish failed: ${publishData.error?.message ?? 'Unknown error'}`
    )
  }

  return {
    postId: publishData.id,
    trackingUrl: `https://www.instagram.com/reel/${publishData.id}/`,
  }
}
