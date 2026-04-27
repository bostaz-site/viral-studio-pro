import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { redis } from '@/lib/upstash'
import { detectMood } from '@/lib/ai/mood-detector'
import { MOOD_PRESETS } from '@/lib/ai/mood-presets'
import type { ClipMood } from '@/lib/ai/mood-presets'
import { enqueueRender } from '@/lib/render-queue'
import {
  resolveClip, checkExistingJob, enforcePlanLimits,
  resolveTwitchUrl, createRenderJob, sendToVps,
} from '@/lib/api/render-helpers'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const quickSchema = z.object({
  clip_id: z.string().uuid(),
  source: z.enum(['clips', 'trending']).optional().default('trending'),
})

/**
 * POST /api/render/quick
 *
 * Quick Export: 1-click render with AI-auto settings.
 * Runs mood detection (best-effort), builds optimal settings, sends to VPS.
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  const rl = await rateLimit(`render:${user.id}`, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Too many renders. Retry in ${Math.ceil((rl.retryAfterMs || 60000) / 1000)}s` },
      { status: 429 },
    )
  }

  // ── Idempotency key — prevent duplicate quick exports from double-clicks ──
  const idempotencyKey = request.headers.get('x-idempotency-key')
  if (idempotencyKey) {
    const redisKey = `idem:quick:${user.id}:${idempotencyKey}`
    const existing = await redis.get<string>(redisKey)
    if (existing) {
      const cached = JSON.parse(existing) as { jobId: string; mood: string }
      return NextResponse.json({
        data: { jobId: cached.jobId, status: 'pending', mood: cached.mood, deduplicated: true },
        error: null,
        message: 'Quick export already in progress (deduplicated)',
      })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON', message: 'Invalid body' },
      { status: 400 },
    )
  }

  const parsed = quickSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Invalid parameters' },
      { status: 400 },
    )
  }

  const { clip_id, source } = parsed.data
  const admin = createAdminClient()

  // ── Resolve clip ──
  const resolved = await resolveClip(admin, clip_id, user.id, source)
  if (resolved instanceof NextResponse) return resolved
  let { videoUrl } = resolved
  const { clipTitle, clipDuration, foundSource, authorName, niche } = resolved

  // ── Idempotency ──
  const existing = await checkExistingJob(admin, clip_id, user.id, foundSource)
  if (existing) return existing

  // ── Plan enforcement ──
  const planError = await enforcePlanLimits(admin, user.id, clipDuration)
  if (planError) return planError

  // ── Resolve Twitch URL ──
  videoUrl = await resolveTwitchUrl(videoUrl, foundSource)

  // ── VPS check ──
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY
  if (!vpsUrl || !vpsKey) {
    return NextResponse.json({
      data: { clip_id, rendered: false, source: foundSource, vpsReady: false },
      error: null,
      message: 'Render server not configured yet.',
    })
  }

  // ── Mood detection (best-effort) ──
  let mood: ClipMood = 'hype'
  let importantWords: string[] = []
  try {
    const moodResult = await detectMood(
      clipTitle ?? '',
      clipTitle ?? undefined,
      authorName ?? undefined,
      niche ?? undefined,
    )
    mood = moodResult.mood
    importantWords = moodResult.important_words ?? []
  } catch {
    // Use defaults — mood detection is nice-to-have for quick export
  }

  // ── Build auto settings from mood preset ──
  const preset = MOOD_PRESETS[mood] ?? MOOD_PRESETS.hype

  const autoSettings = {
    captions: {
      enabled: true,
      style: preset.captionStyle ?? 'word-pop',
      animation: preset.emphasisEffect ?? 'word-pop',
      emphasisEffect: preset.emphasisEffect ?? 'word-pop',
      emphasisColor: '#FFD700',
      wordsPerLine: 4,
      customImportantWords: importantWords,
    },
    splitScreen: {
      enabled: true,
      brollCategory: 'minecraft',
      ratio: 0.35,
    },
    hook: {
      enabled: false,
      textEnabled: false,
      reorderEnabled: false,
    },
    format: {
      aspectRatio: '9:16',
      videoZoom: 'fill',
    },
    smartZoom: {
      enabled: false,
    },
    audioEnhance: {
      enabled: true,
    },
    autoCut: {
      enabled: false,
    },
    tag: { style: 'none' },
  }

  // ── Create render job ──
  const jobResult = await createRenderJob(admin, clip_id, user.id, foundSource)
  if (jobResult instanceof NextResponse) return jobResult
  const job = jobResult

  const renderPayload = {
    jobId: job.id,
    videoUrl,
    clipId: clip_id,
    source: foundSource,
    clipTitle,
    clipDuration,
    wordTimestamps: [],
    settings: autoSettings,
  }

  // Cache idempotency key so duplicate requests return the same job
  if (idempotencyKey) {
    const redisKey = `idem:quick:${user.id}:${idempotencyKey}`
    redis.set(redisKey, JSON.stringify({ jobId: job.id, mood }), { ex: 300 }).catch(() => {})
  }

  // ── Render queue — same concurrency protection as main render route ──
  const queueResult = await enqueueRender(job.id, renderPayload)

  if (!queueResult.accepted) {
    await admin.from('render_jobs').update({ status: 'error', error_message: queueResult.reason ?? 'Queue full' }).eq('id', job.id)
    return NextResponse.json(
      { data: null, error: 'queue_full', message: queueResult.reason ?? 'Too many renders in progress. Try again later.' },
      { status: 429 },
    )
  }

  if (queueResult.position !== null) {
    await admin.from('render_jobs').update({ status: 'queued' }).eq('id', job.id)
    return NextResponse.json({
      data: { jobId: job.id, status: 'queued', mood, queuePosition: queueResult.position },
      error: null,
      message: `Queued — position ${queueResult.position}`,
    })
  }

  // Slot available — fire-and-forget to VPS
  sendToVps(admin, job.id, renderPayload, 'quick-export')

  return NextResponse.json({
    data: { jobId: job.id, status: 'pending', mood },
    error: null,
    message: `Quick export started — mood: ${mood}`,
  })
})
