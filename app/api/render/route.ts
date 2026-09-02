import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveTwitchClipFromUrlOrSlug } from '@/lib/twitch/resolve-clip-url'
import { checkClipDuration, getPlanConfig, resolveEffectivePlan } from '@/lib/plans'
import { logger } from '@/lib/logger'
import { enqueueRender } from '@/lib/render-queue'
import { checkExistingJob, sendToVps } from '@/lib/api/render-helpers'

// Allow larger request body for hook overlay PNG (base64 ~500KB-2MB)
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const inputSchema = z.object({
  clip_id: z.string().uuid(),
  source: z.enum(['clips', 'trending']).optional().default('trending'),
  settings: z.object({
    captions: z.object({
      enabled: z.boolean().optional(),
      style: z.string().optional(),
      fontSize: z.number().optional(),
      color: z.string().optional(),
      position: z.union([z.string(), z.number()]).optional(),
      wordsPerLine: z.number().optional(),
      animation: z.string().optional(),
      emphasisEffect: z.string().optional(),
      emphasisColor: z.string().optional(),
      customImportantWords: z.array(z.string()).optional(),
    }).optional(),
    hook: z.object({
      enabled: z.boolean().optional(),
      textEnabled: z.boolean().optional(),
      reorderEnabled: z.boolean().optional(),
      text: z.string().optional(),
      style: z.enum(['shock', 'curiosity', 'suspense']).optional(),
      length: z.number().optional(),
      textPosition: z.number().optional(),
      overlayPng: z.string().nullable().optional(), // base64 PNG from browser capture
      overlayCapsuleW: z.number().nullable().optional(),
      overlayCapsuleH: z.number().nullable().optional(),
      reorder: z.object({
        segments: z.array(z.object({
          start: z.number(),
          end: z.number(),
          duration: z.number(),
          label: z.string(),
        })),
        totalDuration: z.number(),
        peakTime: z.number(),
      }).nullable().optional(),
    }).optional(),
    tag: z.object({
      style: z.string().optional(),
      size: z.number().optional(),
      authorName: z.string().nullable().optional(),
      authorHandle: z.string().nullable().optional(),
      overlayPng: z.string().nullable().optional(),
      overlayAnchorX: z.number().nullable().optional(),
      overlayAnchorY: z.number().nullable().optional(),
    }).optional(),
    format: z.object({
      aspectRatio: z.string().optional(),
      videoZoom: z.enum(['auto', 'contain', 'fill', 'immersive', 'fullframe', 'fit', 'reaction', 'duo']).optional(),
    }).optional(),
    smartZoom: z.object({
      enabled: z.boolean().optional(),
      mode: z.enum(['micro', 'dynamic', 'follow']).optional(),
    }).optional(),
    audioEnhance: z.object({
      enabled: z.boolean().optional(),
    }).optional(),
    autoCut: z.object({
      enabled: z.boolean().optional(),
      silenceThreshold: z.number().min(0.3).max(2).optional(),
      mood: z.string().optional(),
    }).optional(),
    voiceover: z.object({
      enabled: z.boolean().optional(),
      voice: z.enum(['default', 'female', 'deep']).optional(),
      lines: z.array(z.object({
        text: z.string(),
        startTime: z.number(),
        estimatedDuration: z.number(),
        role: z.enum(['hook', 'reaction', 'closer']),
      })).optional(),
    }).optional(),
  }).optional(),
  variants: z.array(z.object({
    id: z.string(),
    platform: z.string(),
    accountId: z.string().optional(),
  })).max(4).optional(),
})

// ── Route handler — Proxy to VPS Render API ──────────────────────────────────

export const POST = withAuth(async (request, user) => {
  // Rate limit: max 5 renders per minute per user
  const rl = await rateLimit(`render:${user.id}`, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Too many renders. Retry in ${Math.ceil((rl.retryAfterMs || 60000) / 1000)}s` },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON', message: 'Invalid body' },
      { status: 400 }
    )
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Invalid parameters' },
      { status: 400 }
    )
  }

  const { clip_id, source, settings, variants } = parsed.data
  const admin = createAdminClient()

  // ── Try trending_clips first (Browse Clips flow), then user clips ──
  let videoUrl: string | null = null
  let clipTitle: string | null = null
  let clipDuration: number | null = null
  let foundSource: 'trending' | 'clips' | null = null
  let clipPlatform: string | null = null

  if (source === 'trending') {
    const { data: trendingClip } = await admin
      .from('trending_clips')
      .select('*')
      .eq('id', clip_id)
      .single()

    if (trendingClip) {
      foundSource = 'trending'
      videoUrl = trendingClip.external_url
      clipTitle = trendingClip.title
      clipDuration = (trendingClip as Record<string, unknown>).duration_seconds as number | null
      clipPlatform = trendingClip.platform
    }
  }

  // Fallback: check user clips table
  if (!foundSource) {
    const { data: clip } = await admin
      .from('clips')
      .select('*, videos(storage_path, duration_seconds, title)')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .single()

    if (clip) {
      foundSource = 'clips'
      const video = (clip.videos as unknown) as {
        storage_path: string
        duration_seconds: number | null
        title: string | null
      } | null
      videoUrl = video?.storage_path ?? null
      clipTitle = video?.title ?? clip.title
      clipDuration = video?.duration_seconds ?? clip.duration_seconds
    }
  }

  // Fallback: check videos table directly (user-uploaded videos without a clips row)
  if (!foundSource) {
    const { data: video } = await admin
      .from('videos')
      .select('id, title, storage_path, duration_seconds')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .single()

    if (video) {
      foundSource = 'clips'
      // Generate a signed URL for the VPS to download from Supabase Storage
      const { data: signedData } = await admin.storage
        .from('videos')
        .createSignedUrl(video.storage_path, 3600) // 1 hour
      videoUrl = signedData?.signedUrl ?? null
      clipTitle = video.title
      clipDuration = video.duration_seconds
    }
  }

  if (!foundSource || !videoUrl) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  // ── Idempotency: if a render is already in progress for this clip, return it ──
  const existingJob = await checkExistingJob(admin, clip_id, user.id, foundSource)
  if (existingJob) return existingJob

  // ── Plan enforcement (duration + monthly quota) ──────────────────────────
  //
  // This endpoint is the only path into the FFmpeg pipeline for the Browse
  // Clips flow (trending_clips → render). Without these checks a Free user
  // could click "Make it viral" on unlimited trending clips forever.
  //
  // 1. Fetch the caller's plan + bonus balance
  // 2. Enforce clip duration (Whisper bills by the minute — this is the
  //    single most important cost gate)
  // 3. Enforce monthly quota via increment_video_usage RPC (which also
  //    falls through to bonus_videos when the plan quota is exhausted)
  const { data: profile } = await (admin
    .from('profiles')
    .select('plan, is_comp')
    .eq('id', user.id)
    .single() as unknown as Promise<{ data: { plan: string | null; is_comp: boolean | null } | null }>)

  const callerPlan = resolveEffectivePlan(profile)

  // Duration check — skip if we don't know the duration (will rely on VPS)
  if (typeof clipDuration === 'number' && clipDuration > 0) {
    const durationCheck = checkClipDuration(callerPlan, clipDuration)
    if (!durationCheck.allowed) {
      return NextResponse.json(
        {
          data: { currentUsage: durationCheck.currentUsage, limit: durationCheck.limit, plan: durationCheck.plan },
          error: 'clip_too_long',
          message: durationCheck.reason ?? 'Clip trop long pour ton plan',
        },
        { status: 402 },
      )
    }
  }

  // Monthly quota check (also decrements bonus_videos if plan quota is spent)
  const maxVideos = getPlanConfig(callerPlan).limits.maxVideosPerMonth
  const { data: quotaAllowed, error: quotaError } = await admin.rpc('increment_video_usage', {
    p_user_id: user.id,
    p_max_videos: maxVideos,
  })

  if (quotaError) {
    logger.error('[render] increment_video_usage failed:', quotaError)
    return NextResponse.json(
      { data: null, error: 'quota_check_failed', message: 'Failed to check quota. Try again.' },
      { status: 500 },
    )
  }

  if (quotaAllowed === false) {
    // Fetch current usage for diagnostics
    const { data: usageRow } = await (admin
      .from('profiles')
      .select('monthly_videos_used, bonus_videos')
      .eq('id', user.id)
      .single() as unknown as Promise<{ data: { monthly_videos_used: number; bonus_videos: number } | null }>)

    return NextResponse.json(
      {
        data: {
          plan: callerPlan,
          current: usageRow?.monthly_videos_used ?? -1,
          limit: maxVideos,
          bonus: usageRow?.bonus_videos ?? 0,
        },
        error: 'quota_exceeded',
        message: `Monthly limit reached for ${callerPlan} plan (${usageRow?.monthly_videos_used ?? '?'}/${maxVideos}). Upgrade to continue.`,
      },
      { status: 402 },
    )
  }

  // ── Resolve Twitch CloudFront URL as FALLBACK only ──
  //
  // For renders, we send the ORIGINAL page URL (trending_clips.external_url)
  // as the primary videoUrl — yt-dlp on the VPS resolves it to the BEST
  // available quality (source 1080p60 for most streamers). The unauthenticated
  // CloudFront token we can resolve here is capped at ~720p.
  //
  // The CloudFront URL is sent as fallbackUrl for robustness: if yt-dlp fails
  // on the page (version mismatch, geo-block), the VPS can still render at 720p.
  let fallbackUrl: string | null = null
  if (foundSource === 'trending' && videoUrl && videoUrl.includes('twitch.tv')) {
    try {
      fallbackUrl = await resolveTwitchClipFromUrlOrSlug(videoUrl)
    } catch (err) {
      logger.warn(
        '[render] Twitch fallback URL resolution failed (non-blocking):',
        err instanceof Error ? err.message : err,
      )
    }
  }

  // ── VPS render ──
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
    // Refund quota — no render will happen
    const { error: refundErr } = await admin.rpc('refund_video_usage' as never, { p_user_id: user.id, p_count: 1 } as never)
    if (refundErr) logger.error(`[render] refund failed (vps not configured) for user ${user.id}:`, refundErr)
    return NextResponse.json({
      data: { clip_id, rendered: false, source: foundSource, vpsReady: false, originalUrl: videoUrl },
      error: null,
      message: 'Render server not configured yet. You can download the original clip for now.',
    })
  }

  // Get word timestamps for subtitles (only for user clips with transcriptions)
  let wordTimestamps: unknown[] = []
  if (foundSource === 'clips') {
    const { data: transcription } = await admin
      .from('transcriptions')
      .select('word_timestamps')
      .eq('video_id', clip_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    wordTimestamps = (transcription?.word_timestamps as unknown[] | null) ?? []
  }

  // ── Create render job for tracking ──
  // Build a lean snapshot of render settings for learning loop (published_posts metadata).
  // Excludes binary blobs (overlayPng) to keep the JSONB column small.
  const renderSettingsSnapshot = settings ? {
    caption_style: settings.captions?.style ?? null,
    caption_enabled: settings.captions?.enabled ?? null,
    hook_enabled: settings.hook?.enabled ?? null,
    hook_style: settings.hook?.style ?? null,
    smart_zoom_mode: settings.smartZoom?.mode ?? null,
    smart_zoom_enabled: settings.smartZoom?.enabled ?? null,
    audio_enhance_enabled: settings.audioEnhance?.enabled ?? null,
    auto_cut_enabled: settings.autoCut?.enabled ?? null,
    auto_cut_mood: settings.autoCut?.mood ?? null,
    video_zoom: settings.format?.videoZoom ?? null,
    aspect_ratio: settings.format?.aspectRatio ?? null,
  } : null

  const { data: job, error: jobError } = await admin
    .from('render_jobs')
    .insert({
      clip_id,
      source: foundSource,
      user_id: user.id,
      status: 'pending',
      render_settings: renderSettingsSnapshot,
      removed_from_bank_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()

  if (jobError || !job) {
    // Refund quota — no render will happen
    const { error: refundErr2 } = await admin.rpc('refund_video_usage' as never, { p_user_id: user.id, p_count: 1 } as never)
    if (refundErr2) logger.error(`[render] refund failed (job creation) for user ${user.id}:`, refundErr2)
    return NextResponse.json(
      { data: null, error: 'Job creation failed', message: 'Unable to start the render' },
      { status: 500 }
    )
  }

  // ── Auto-generate platform variants if user has 2+ platforms connected ──
  let resolvedVariants = variants
  if (!resolvedVariants || resolvedVariants.length === 0) {
    try {
      const { data: accounts } = await admin
        .from('social_accounts')
        .select('platform')
        .eq('user_id', user.id)
        .is('disconnected_at', null)

      if (accounts && accounts.length >= 2) {
        const seenPlatforms = new Set<string>()
        resolvedVariants = accounts
          .filter(a => {
            if (seenPlatforms.has(a.platform)) return false
            seenPlatforms.add(a.platform)
            return true
          })
          .map(a => ({ id: a.platform, platform: a.platform }))
      }
    } catch {
      // Non-fatal — render proceeds without variants
    }
  }

  logger.info(`[render] Sending to VPS: clip_id=${clip_id} source=${foundSource} variants=${resolvedVariants?.length ?? 0} videoUrl=${videoUrl ? videoUrl.substring(0, 80) : 'NULL'}`)

  const renderPayload = {
    jobId: job.id,
    videoUrl,
    fallbackUrl,
    clipId: clip_id,
    source: foundSource,
    userId: user.id,
    clipTitle,
    clipDuration,
    wordTimestamps,
    plan: callerPlan,
    watermark: { enabled: callerPlan === 'free' },
    settings: {
      captions: settings?.captions ?? { enabled: true, style: 'word-pop', wordsPerLine: 4 },
      hook: {
        ...(settings?.hook ?? { enabled: false }),
        reorderEnabled: false, // disabled (cuts mid-word)
        reorder: null,
      },
      tag: settings?.tag ?? { style: 'none' },
      format: {
        aspectRatio: settings?.format?.aspectRatio ?? '9:16',
        videoZoom: settings?.format?.videoZoom ?? 'auto',
      },
      smartZoom: settings?.smartZoom ?? { enabled: false, mode: 'micro' },
      audioEnhance: settings?.audioEnhance ?? { enabled: false },
      autoCut: settings?.autoCut ?? { enabled: true, silenceThreshold: 1.2 },
      voiceover: settings?.voiceover ?? { enabled: true },
      sourcePlatform: clipPlatform ?? undefined,
    },
    variants: resolvedVariants && resolvedVariants.length > 0 ? resolvedVariants : undefined,
  }

  // ── Queue management — limit VPS concurrency ──
  const queueResult = await enqueueRender(job.id, renderPayload)

  if (!queueResult.accepted) {
    // Queue full — refund, mark job as error
    const { error: refundErr3 } = await admin.rpc('refund_video_usage' as never, { p_user_id: user.id, p_count: 1 } as never)
    if (refundErr3) logger.error(`[render] refund failed (queue full) for user ${user.id}:`, refundErr3)
    await admin.from('render_jobs').update({
      status: 'error',
      error_message: queueResult.reason ?? 'Queue full',
    }).eq('id', job.id)
    return NextResponse.json(
      { data: null, error: 'queue_full', message: queueResult.reason ?? 'Too many renders in progress. Try again later.' },
      { status: 429 },
    )
  }

  if (queueResult.position !== null) {
    // Queued — processAndDispatchNext will send it when a slot frees up
    await admin.from('render_jobs').update({ status: 'queued' }).eq('id', job.id)
    return NextResponse.json({
      data: { clip_id, jobId: job.id, rendered: false, source: foundSource, vpsReady: true, queuePosition: queueResult.position },
      error: null,
      message: `Queued — position ${queueResult.position}. Your clip will render soon.`,
    })
  }

  // Slot available — dispatch to VPS immediately (fire-and-forget)
  sendToVps(admin, job.id, user.id, renderPayload)

  return NextResponse.json({
    data: { clip_id, jobId: job.id, rendered: false, source: foundSource, vpsReady: true, originalUrl: videoUrl },
    error: null,
    message: 'Render started — clip will be ready in a few seconds',
  })
})

export type RenderResult = {
  clip_id: string
  storage_path?: string
  clip_url?: string
  render_time?: string
  duration?: number
  rendered: boolean
  source?: string
}
