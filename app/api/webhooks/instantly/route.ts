import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { processInstantlyEvent } from '@/lib/admin/webhooks/instantly-processor'
import { instantlyWebhookSchema } from '@/lib/schemas/cold-email'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/webhooks/instantly
 *
 * Receives all Instantly webhook events (sent, replied, bounced, unsubscribed).
 * Validates with zod, deduplicates via webhook_events, processes via instantly-processor.
 * Reply classification + bucket handling is in the processor.
 */

function verifyWebhookToken(req: NextRequest): boolean {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook/instantly] INSTANTLY_WEBHOOK_SECRET not configured')
    return false
  }

  // Support both query param and header
  const token = req.nextUrl.searchParams.get('token')
    ?? req.headers.get('x-instantly-secret')
    ?? ''
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
  if (!verifyWebhookToken(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await rateLimit(`webhook:instantly:${ip}`, RATE_LIMITS.webhook.limit, RATE_LIMITS.webhook.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
  }

  try {
    const raw = await req.json()

    // Normalize nested reply format to flat (Instantly sends both formats)
    const payload = raw.reply
      ? { event_type: 'email_replied', ...raw.reply, ...(raw.event_type ? { event_type: raw.event_type } : {}) }
      : raw

    const parsed = instantlyWebhookSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const eventType = (payload.event_type || payload.event || 'unknown') as string
    const eventId =
      payload.id ||
      payload.event_id ||
      `${eventType}_${payload.timestamp || Date.now()}_${payload.email || ''}`
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')

    const admin = createAdminClient()

    // INSERT with ON CONFLICT DO NOTHING (idempotency)
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

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      console.error('[webhook/instantly] Insert error:', insertError)
      return NextResponse.json({ ok: false, error: 'Insert failed' }, { status: 500 })
    }

    // Process the event (classification + bucket logic lives here)
    try {
      await processInstantlyEvent(admin, webhookEvent.id, eventType, payload as Record<string, unknown>)
      await admin
        .from('webhook_events')
        .update({ processing_status: 'completed', processed_at: new Date().toISOString() })
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
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
