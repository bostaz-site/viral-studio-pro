import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHmac } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { releaseJob, enqueueRender, cleanupPayload, removeFromQueue } from '@/lib/render-queue'
import { processAndDispatchNext } from '@/lib/api/dispatch-render'
import { dispatchToVps } from '@/lib/api/render-helpers'
import { redis } from '@/lib/upstash'
import { timingSafeCompare } from '@/lib/crypto'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { RenderStatus } from '@/types/enums'
import { logger } from '@/lib/logger'
import { notifyRenderFailed, notifyFirstRender, notifyQueueCongestion } from '@/lib/discord/notify'

// ── Hook text generation (frontend → VPS proxy) ──────────────────

const inputSchema = z.object({
  transcript: z.string().optional().default(''),
  wordTimestamps: z.array(z.object({
    word: z.string(),
    start: z.number(),
    end: z.number(),
  })).optional().default([]),
  audioPeaks: z.array(z.object({
    time: z.number(),
    amplitude: z.number(),
  })).optional().default([]),
  duration: z.number().optional().default(30),
  title: z.string().optional().default(''),
  streamerName: z.string().optional().default(''),
  niche: z.string().optional().default('irl'),
  hookLength: z.number().min(0).max(300).optional().default(0),
  maxContext: z.number().optional().default(8),
})

// ── VPS webhook (render completion callback) ─────────────────────

const webhookSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['done', 'degraded', 'error']),
  storagePath: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  timestamp: z.number().optional(),
  wordCount: z.number().optional(),
})

/**
 * Verify VPS webhook authenticity.
 * Priority: HMAC signature (WEBHOOK_SECRET) > API key header (legacy fallback).
 *
 * Set WEBHOOK_HMAC_ONLY=true once VPS is deployed with HMAC signatures.
 * This disables the legacy X-Api-Key fallback, which is less secure because
 * a leaked API key allows forging arbitrary webhook payloads.
 */
function verifyWebhook(req: NextRequest, body: string): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET
  const vpsKey = process.env.VPS_RENDER_API_KEY
  const hmacOnly = process.env.WEBHOOK_HMAC_ONLY === 'true'

  // 1. HMAC signature (preferred) — uses dedicated WEBHOOK_SECRET
  const signature = req.headers.get('x-webhook-signature')
  if (signature && webhookSecret) {
    const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(body).digest('hex')
    return expected.length === signature.length && timingSafeCompare(signature, expected)
  }

  // 2. API key header (legacy fallback — disabled when WEBHOOK_HMAC_ONLY=true)
  if (!hmacOnly && vpsKey) {
    const apiKey = req.headers.get('x-api-key')
    if (apiKey) {
      return timingSafeCompare(apiKey, vpsKey)
    }
  }

  return false
}

export async function POST(req: NextRequest) {
  // Determine if this is a VPS webhook or a frontend hook generation request.
  // VPS sends x-webhook-signature or x-api-key; frontend sends JWT cookie.
  const hasVpsAuth = req.headers.get('x-webhook-signature') || req.headers.get('x-api-key')

  if (hasVpsAuth) {
    return handleWebhook(req)
  }

  // Frontend request — delegate to withAuth handler
  return hookGenerationHandler(req)
}

// ── VPS Webhook Handler ──────────────────────────────────────────

async function handleWebhook(req: NextRequest) {
  logger.info('[webhook] Inbound render hook', { source: 'vps', timestamp: new Date().toISOString() })
  const body = await req.text()
  const hmacValid = verifyWebhook(req, body)

  // Fail-closed: invalid or missing signature = always reject (no warn-only mode)
  if (!hmacValid) {
    logger.error('[render/hook] HMAC invalid or missing — rejecting webhook')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: z.infer<typeof webhookSchema>
  try {
    payload = webhookSchema.parse(JSON.parse(body))
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Anti-replay: reject if timestamp is missing or > 5 minutes old
  if (!payload.timestamp) {
    return NextResponse.json({ error: 'Timestamp required' }, { status: 400 })
  }
  if (payload.timestamp) {
    const age = Date.now() - payload.timestamp
    if (age > 5 * 60 * 1000 || age < -60_000) {
      return NextResponse.json({ error: 'Timestamp too old or in future' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // Fetch the current job to check retry state
  const { data: currentJob } = await admin
    .from('render_jobs')
    .select('id, clip_id, source, status, retry_count, max_retries, user_id')
    .eq('id', payload.jobId)
    .single()

  if (!currentJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const retryCount = currentJob.retry_count ?? 0
  const maxRetries = currentJob.max_retries ?? 2

  // ── CLIP_DELETED: skip retries, mark trending_clip as dead ──
  const isClipDeleted = payload.errorMessage?.includes('CLIP_DELETED') ?? false
  if (isClipDeleted && currentJob.source === 'trending') {
    Promise.resolve(
      admin
        .from('trending_clips')
        .update({ tier: 'dead', feed_category: 'normal', next_check_at: null })
        .eq('id', currentJob.clip_id)
    ).then(() => {
      logger.info(`[webhook] Marked trending_clip ${currentJob.clip_id} as dead (clip deleted at source)`)
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[webhook] Failed to mark trending_clip as dead: ${msg}`)
    })
  }

  // ── Retry / Dead-letter logic ──
  if (payload.status === 'error' && retryCount < maxRetries && !isClipDeleted) {
    // Retriable failure — re-enqueue the job
    logger.info(`[webhook] Job ${payload.jobId} failed (attempt ${retryCount + 1}/${maxRetries}), re-queuing`)

    await admin
      .from('render_jobs')
      .update({
        status: 'queued',
        retry_count: retryCount + 1,
        error_message: payload.errorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.jobId)

    // Free the current slot
    await releaseJob(payload.jobId)

    // Retrieve stored payload, re-enqueue, and dispatch
    const storedRaw = await redis.get<string>(`render:payload:${payload.jobId}`)
    if (storedRaw) {
      const storedPayload = JSON.parse(storedRaw) as Record<string, unknown>
      const enqResult = await enqueueRender(payload.jobId, storedPayload)
      // If a slot was available (position=null), dispatch immediately
      if (enqResult.accepted && enqResult.position === null) {
        await dispatchToVps(admin, payload.jobId, (currentJob.user_id as string) ?? '', storedPayload, 'retry-dispatch')
      } else if (enqResult.accepted && enqResult.position !== null) {
        // Queued — processAndDispatchNext will pick it up when a slot frees
      }
    }

    return NextResponse.json({ data: { retried: true, attempt: retryCount + 1 }, error: null })
  }

  // ── Final status update (done, degraded, OR permanent failure) ──
  // 'degraded' = clip produced but a critical feature was missing → treat as success + refund
  const finalStatus: RenderStatus = payload.status === 'error' ? 'failed' : (payload.status as RenderStatus)
  const updateData: Record<string, unknown> = {
    status: finalStatus,
    updated_at: new Date().toISOString(),
  }
  if (payload.storagePath) updateData.storage_path = payload.storagePath
  if (payload.status === 'error') {
    updateData.error_message = payload.errorMessage || 'Max retries exceeded'
    Sentry.captureMessage(`Render permanently failed: ${payload.errorMessage ?? 'unknown'}`, {
      level: 'error',
      tags: { money_path: 'true', route: '/api/render/hook' },
      extra: { jobId: payload.jobId, clipId: currentJob.clip_id, userId: currentJob.user_id, retryCount: retryCount },
    })

    // Count consecutive failures to detect VPS outage
    const failStreak = await redis.incr('render:fail_streak')
    if (failStreak === 1) await redis.expire('render:fail_streak', 600) // 10 min window

    void notifyRenderFailed({
      jobId: payload.jobId,
      clipId: currentJob.clip_id as string,
      userId: (currentJob.user_id as string) ?? 'unknown',
      errorMessage: payload.errorMessage || 'Max retries exceeded',
      consecutiveFailures: failStreak,
    }).catch(() => {})
  }

  const { error } = await admin
    .from('render_jobs')
    .update(updateData)
    .eq('id', payload.jobId)

  if (error) {
    logger.error('[webhook] Failed to update job:', error.message)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // Clean up heartbeat key + stored payload (terminal state — no more retries)
  redis.del(`render:heartbeat:${payload.jobId}`).catch(() => {})
  cleanupPayload(payload.jobId).catch(() => {})

  // Free queue slot and dispatch next job
  await releaseJob(payload.jobId)
  processAndDispatchNext(admin).catch(() => {})

  // Queue congestion check (>10 waiting = alert)
  redis.llen('render:queue').then(queued => {
    if (queued > 10) {
      redis.scard('render:active_jobs').then(active => {
        void notifyQueueCongestion({ queued, active }).catch(() => {})
      }).catch(() => {})
    }
  }).catch(() => {})

  // Increment export_count (idempotent) — both 'done' and 'degraded' count as success
  if (payload.status === 'done' || payload.status === 'degraded') {
    // Reset consecutive failure counter on success
    redis.del('render:fail_streak').catch(() => {})

    // Check if this is the user's first render (activation milestone)
    if (currentJob.user_id) {
      const uid = currentJob.user_id as string
      Promise.resolve(
        admin
          .from('render_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .in('status', ['done', 'degraded'])
          .neq('id', payload.jobId)
      ).then(({ count }) => {
        if (count === 0) {
          void notifyFirstRender({ userId: uid }).catch(() => {})
        }
      }).catch(() => {})
    }

    if (currentJob.source === 'trending') {
      redis.set(`export_counted:${payload.jobId}`, '1', { nx: true, ex: 86400 })
        .then(result => {
          if (result === 'OK') {
            return (admin.rpc as CallableFunction)('increment_export_count', { p_clip_id: currentJob.clip_id })
          }
        })
        .catch(() => {})
    }

    // Referral reward on first render completion (non-blocking)
    if (currentJob.user_id) {
      const uid = currentJob.user_id as string
      import('@/lib/referral-reward')
        .then(({ grantReferralRewardOnFirstRender }) =>
          grantReferralRewardOnFirstRender(uid)
        )
        .catch(() => {})
    }

    // Truth loop: store Whisper wordCount in candidate_metrics for calibrating
    // the silencedetect proxy used in pre-render candidate checks.
    if (typeof payload.wordCount === 'number' && currentJob.source === 'trending') {
      const clipId = currentJob.clip_id as string
      ;(admin
        .from('trending_clips')
        .select('candidate_metrics')
        .eq('id', clipId)
        .single() as unknown as Promise<{ data: { candidate_metrics: Record<string, unknown> | null } | null }>)
        .then(({ data }) => {
          const existing = data?.candidate_metrics ?? {}
          return (admin
            .from('trending_clips')
            .update({
              candidate_metrics: { ...existing, whisperWordCount: payload.wordCount },
            } as never)
            .eq('id', clipId) as unknown as Promise<unknown>)
        })
        .catch(() => {})
    }
  }

  // Refund quota when render permanently fails OR is degraded (not user's fault)
  // Degraded = clip produced but critical feature missing — user shouldn't pay for broken output
  if ((finalStatus === 'failed' || finalStatus === 'degraded') && currentJob.user_id) {
    const { error: refundErr } = await admin.rpc('refund_video_usage' as never, {
      p_user_id: currentJob.user_id,
      p_count: 1,
    } as never)
    if (refundErr) {
      logger.error(`[webhook] CRITICAL: refund_video_usage failed for user ${currentJob.user_id}, job ${payload.jobId}:`, refundErr)
    }
    if (finalStatus === 'degraded') {
      logger.info(`[webhook] Degraded render ${payload.jobId} — quota refunded for user ${currentJob.user_id}`)
    }
  }

  return NextResponse.json({ data: { updated: true, finalStatus }, error: null })
}

// ── Frontend Hook Generation Handler ─────────────────────────────

const hookGenerationHandler = withAuth(async (req: NextRequest, user) => {
  try {
    // Plan-aware rate limit: 50/day free, 500/day pro/studio
    const admin = createAdminClient()
    const { data: profile } = await (admin
      .from('profiles')
      .select('plan, is_comp')
      .eq('id', user.id)
      .single() as unknown as Promise<{ data: { plan: string | null; is_comp: boolean | null } | null }>)
    const { resolveEffectivePlan } = await import('@/lib/plans')
    const effectivePlan = resolveEffectivePlan(profile)
    const rlConfig = effectivePlan === 'free'
      ? RATE_LIMITS.renderHook
      : RATE_LIMITS.renderHookPro
    const rl = await rateLimit(`render-hook:${user.id}`, rlConfig.limit, rlConfig.windowMs)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: effectivePlan === 'free'
            ? 'Daily limit reached (50/day). Upgrade to Pro for 500/day.'
            : 'Daily limit reached. Please try again tomorrow.',
          message: 'Rate limited',
        },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = inputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message, message: 'Invalid input' },
        { status: 400 }
      )
    }

    const VPS_URL = process.env.VPS_RENDER_URL
    const VPS_KEY = process.env.VPS_RENDER_API_KEY

    if (!VPS_URL) {
      return NextResponse.json(
        { data: null, error: 'VPS not configured', message: 'VPS_RENDER_URL not set' },
        { status: 500 }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const vpsRes = await fetch(`${VPS_URL}/api/render/hook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(VPS_KEY ? { 'x-api-key': VPS_KEY } : {}),
      },
      body: JSON.stringify(parsed.data),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const vpsJson = await vpsRes.json()

    if (!vpsRes.ok) {
      return NextResponse.json(
        { data: null, error: vpsJson.error || 'VPS error', message: vpsJson.message || 'Hook generation failed' },
        { status: vpsRes.status }
      )
    }

    return NextResponse.json(vpsJson)
  } catch (err) {
    logger.error('[API/render/hook] Error:', err)
    return NextResponse.json(
      { data: null, error: 'Internal error', message: 'Failed to generate hooks' },
      { status: 500 }
    )
  }
})
