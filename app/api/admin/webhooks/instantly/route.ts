import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { processInstantlyEvent } from '@/lib/admin/webhooks/instantly-processor'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * Verify webhook token using timing-safe comparison.
 * Returns true if token is valid, false if invalid.
 * If INSTANTLY_WEBHOOK_SECRET is not set, logs warning and allows (dev mode).
 */
function verifyWebhookToken(req: NextRequest): boolean {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET
  if (!secret) {
    // TODO-LAUNCH: Set INSTANTLY_WEBHOOK_SECRET before going live.
    // Without it, anyone can POST to this endpoint.
    console.warn('[webhook/instantly] INSTANTLY_WEBHOOK_SECRET not set — accepting all requests (dev mode)')
    return true
  }

  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!token) return false

  try {
    const a = Buffer.from(token, 'utf8')
    const b = Buffer.from(secret, 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // 1. Token authentication
  if (!verifyWebhookToken(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit (100 req/min per IP)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await rateLimit(`webhook:instantly:${ip}`, RATE_LIMITS.webhook.limit, RATE_LIMITS.webhook.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
  }

  try {
    const payload = await req.json()
    const eventType = payload.event_type || payload.event || 'unknown'
    const eventId =
      payload.id ||
      payload.event_id ||
      `${eventType}_${payload.timestamp || Date.now()}_${payload.email || ''}`
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')

    const admin = createAdminClient()

    // 3. INSERT FIRST with ON CONFLICT DO NOTHING (idempotency)
    const { data: webhookEvent, error: insertError } = await admin
      .from('webhook_events')
      .insert({
        provider: 'instantly',
        event_id: eventId,
        event_type: eventType,
        payload,
        payload_hash: payloadHash,
        processing_status: 'processing',
      })
      .select('id')
      .single()

    // Duplicate — unique constraint on (provider, event_id)
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      console.error('[webhook/instantly] Insert error:', insertError)
      return NextResponse.json(
        { ok: false, error: 'Insert failed' },
        { status: 500 }
      )
    }

    // 4. Process the event
    try {
      await processInstantlyEvent(admin, webhookEvent.id, eventType, payload)
      await admin
        .from('webhook_events')
        .update({
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEvent.id)
    } catch (err) {
      console.error('[webhook/instantly] Processing error:', err)
      await admin
        .from('webhook_events')
        .update({
          processing_status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('id', webhookEvent.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook/instantly] Fatal error:', err)
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 }
    )
  }
}
