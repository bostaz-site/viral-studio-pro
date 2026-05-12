import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { processInstantlyEvent } from '@/lib/admin/webhooks/instantly-processor'

export async function POST(req: NextRequest) {
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

    // 1. INSERT FIRST with ON CONFLICT DO NOTHING (idempotency)
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

    // 2. Process the event
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
