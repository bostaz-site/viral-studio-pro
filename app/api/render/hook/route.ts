import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHmac } from 'crypto'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { releaseJob, processNextInQueue, enqueueRender } from '@/lib/render-queue'
import { redis } from '@/lib/upstash'
import { timingSafeCompare } from '@/lib/crypto'
import type { RenderStatus } from '@/types/enums'

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
  status: z.enum(['done', 'error']),
  storagePath: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  timestamp: z.number().optional(),
})

/**
 * Verify VPS webhook authenticity.
 * Priority: HMAC signature > API key header (legacy fallback).
 *
 * Set WEBHOOK_HMAC_ONLY=true once VPS is updated to send HMAC signatures.
 * This disables the legacy X-Api-Key fallback, which is less secure because
 * a leaked API key allows forging arbitrary webhook payloads.
 */
function verifyWebhook(req: NextRequest, body: string): boolean {
  const vpsKey = process.env.VPS_RENDER_API_KEY
  if (!vpsKey) return false

  const hmacOnly = process.env.WEBHOOK_HMAC_ONLY === 'true'

  // 1. HMAC signature (preferred)
  const signature = req.headers.get('x-webhook-signature')
  if (signature) {
    const expectedSig = createHmac('sha256', vpsKey).update(body).digest('hex')
    return timingSafeCompare(signature, expectedSig)
  }

  // 2. API key header (legacy fallback — disabled when WEBHOOK_HMAC_ONLY=true)
  if (!hmacOnly) {
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
  const body = await req.text()

  if (!verifyWebhook(req, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: z.infer<typeof webhookSchema>
  try {
    payload = webhookSchema.parse(JSON.parse(body))
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Anti-replay: reject if timestamp is > 5 minutes old
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
    .select('id, clip_id, source, status, retry_count, max_retries')
    .eq('id', payload.jobId)
    .single()

  if (!currentJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const retryCount = currentJob.retry_count ?? 0
  const maxRetries = currentJob.max_retries ?? 2

  // ── Retry / Dead-letter logic ──
  if (payload.status === 'error' && retryCount < maxRetries) {
    // Retriable failure — re-enqueue the job
    console.log(`[webhook] Job ${payload.jobId} failed (attempt ${retryCount + 1}/${maxRetries}), re-queuing`)

    await admin
      .from('render_jobs')
      .update({
        status: 'queued',
        retry_count: retryCount + 1,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.jobId)

    // Free the current slot
    await releaseJob(payload.jobId)

    // Retrieve stored payload and re-enqueue for retry
    const storedRaw = await redis.get<string>(`render:payload:${payload.jobId}`)
    if (storedRaw) {
      const storedPayload = JSON.parse(storedRaw) as Record<string, unknown>
      await enqueueRender(payload.jobId, storedPayload)
    }

    return NextResponse.json({ data: { retried: true, attempt: retryCount + 1 }, error: null })
  }

  // ── Final status update (done OR permanent failure) ──
  const finalStatus: RenderStatus = payload.status === 'error' ? 'failed' : payload.status
  const updateData: Record<string, unknown> = {
    status: finalStatus,
    updated_at: new Date().toISOString(),
  }
  if (payload.storagePath) updateData.storage_path = payload.storagePath
  if (payload.status === 'error') {
    updateData.error_message = payload.errorMessage || 'Max retries exceeded'
  }

  const { error } = await admin
    .from('render_jobs')
    .update(updateData)
    .eq('id', payload.jobId)

  if (error) {
    console.error('[webhook] Failed to update job:', error.message)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // Clean up heartbeat key if present
  redis.del(`render:heartbeat:${payload.jobId}`).catch(() => {})

  // Free queue slot and dispatch next job
  await releaseJob(payload.jobId)
  processNextInQueue().catch(() => {})

  // Increment export_count (idempotent)
  if (payload.status === 'done') {
    if (currentJob.source === 'trending') {
      redis.set(`export_counted:${payload.jobId}`, '1', { nx: true, ex: 86400 })
        .then(result => {
          if (result === 'OK') {
            return (admin.rpc as CallableFunction)('increment_export_count', { p_clip_id: currentJob.clip_id })
          }
        })
        .catch(() => {})
    }
  }

  return NextResponse.json({ data: { updated: true, finalStatus }, error: null })
}

// ── Frontend Hook Generation Handler ─────────────────────────────

const hookGenerationHandler = withAuth(async (req: NextRequest) => {
  try {
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
    console.error('[API/render/hook] Error:', err)
    return NextResponse.json(
      { data: null, error: 'Internal error', message: 'Failed to generate hooks' },
      { status: 500 }
    )
  }
})
