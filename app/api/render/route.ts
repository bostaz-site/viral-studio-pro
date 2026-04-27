import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveTwitchClipFromUrlOrSlug } from '@/lib/twitch/resolve-clip-url'
import { checkClipDuration, getPlanConfig } from '@/lib/plans'

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
    splitScreen: z.object({
      enabled: z.boolean().optional(),
      layout: z.string().optional(),
      brollCategory: z.string().optional(),
      ratio: z.number().optional(),
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
      videoZoom: z.enum(['contain', 'fill', 'immersive']).optional(),
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
    }).optional(),
  }).optional(),
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

  const { clip_id, source, settings } = parsed.data
  const admin = createAdminClient()

  // ── Try trending_clips first (Browse Clips flow), then user clips ──
  let videoUrl: string | null = null
  let clipTitle: string | null = null
  let clipDuration: number | null = null
  let foundSource: 'trending' | 'clips' | null = null

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
    .select('plan')
    .eq('id', user.id)
    .single() as unknown as Promise<{ data: { plan: string | null } | null }>)

  const callerPlan = profile?.plan ?? 'free'

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
    console.error('[render] increment_video_usage failed:', quotaError)
    return NextResponse.json(
      { data: null, error: 'quota_check_failed', message: 'Failed to check quota. Try again.' },
      { status: 500 },
    )
  }

  if (quotaAllowed === false) {
    return NextResponse.json(
      {
        data: { plan: callerPlan },
        error: 'quota_exceeded',
        message: `Monthly limit reached for ${callerPlan} plan. Upgrade to continue.`,
      },
      { status: 402 },
    )
  }

  // ── Resolve Twitch webpage URLs to signed CloudFront MP4s ──
  //
  // trending_clips.external_url is the Twitch webpage (e.g.
  // https://www.twitch.tv/ishowspeed/clip/Endearing...) — downloading that
  // with yt-dlp or fetch returns HTML, not video bytes. We need to hit the
  // Twitch GQL API to get a signed MP4 URL before handing it to the VPS.
  //
  // If resolution fails (Twitch changed their API, clip was deleted, network
  // error), fall back to the raw URL and let the VPS try yt-dlp — it may
  // still succeed for non-Twitch sources or if yt-dlp was updated recently.
  if (foundSource === 'trending' && videoUrl.includes('twitch.tv')) {
    try {
      const resolved = await resolveTwitchClipFromUrlOrSlug(videoUrl)
      console.log(`[render] Resolved Twitch clip to signed CDN URL`)
      videoUrl = resolved
    } catch (err) {
      console.warn(
        '[render] Twitch clip resolution failed, falling back to raw URL:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  // ── VPS render ──
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
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
  const { data: job, error: jobError } = await admin
    .from('render_jobs')
    .insert({
      clip_id,
      source: foundSource,
      user_id: user.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { data: null, error: 'Job creation failed', message: 'Impossible de lancer le rendu' },
      { status: 500 }
    )
  }

  const renderPayload = {
    jobId: job.id,
    videoUrl,
    clipId: clip_id,
    source: foundSource,
    clipTitle,
    clipDuration,
    wordTimestamps,
    settings: {
      captions: settings?.captions ?? { enabled: true, style: 'word-pop', wordsPerLine: 4 },
      splitScreen: settings?.splitScreen ?? { enabled: false },
      hook: settings?.hook ?? { enabled: false },
      tag: settings?.tag ?? { style: 'none' },
      format: {
        aspectRatio: settings?.format?.aspectRatio ?? '9:16',
        videoZoom: settings?.format?.videoZoom ?? 'contain',
      },
      smartZoom: settings?.smartZoom ?? { enabled: false, mode: 'micro' },
      audioEnhance: settings?.audioEnhance ?? { enabled: false },
      autoCut: settings?.autoCut ?? { enabled: false },
    },
  }

  // Fire-and-forget to VPS.
  //
  // The VPS /api/render endpoint is SYNCHRONOUS — it runs the full render
  // (download + FFmpeg + Supabase upload, 30-90s) before responding. We
  // don't wait for that response: we only care that the POST body was
  // delivered. The VPS writes status updates directly to the render_jobs
  // table, which is the single source of truth for the polling UI.
  //
  // We abort the fetch after 15s — that is plenty of time to deliver a
  // multi-MB POST body (hook/tag overlay PNGs can be ~2 MB each) but well
  // short of the render time. On AbortError we KEEP the job in its
  // current state and let the VPS drive it to 'done'/'error'. On any
  // other error (DNS failure, connection refused, non-2xx response on
  // the handshake) we mark the job as errored so the UI surfaces it.
  const sendToVps = async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      await fetch(`${vpsUrl}/api/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': vpsKey,
        },
        body: JSON.stringify(renderPayload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (err) {
      clearTimeout(timeoutId)
      // AbortError = our own timeout kicked in, which means the POST body
      // was already flushed to the VPS. The render is in progress and the
      // VPS will update the job status itself. Do NOT overwrite the row.
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError')
      if (isAbort) {
        console.log('[render] VPS POST body delivered, letting VPS drive the job')
        return
      }
      console.error('[render] VPS unreachable:', err)
      await admin
        .from('render_jobs')
        .update({
          status: 'error',
          error_message: `VPS unreachable: ${err instanceof Error ? err.message : 'unknown error'}`,
        })
        .eq('id', job.id)
    }
  }
  sendToVps()

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
