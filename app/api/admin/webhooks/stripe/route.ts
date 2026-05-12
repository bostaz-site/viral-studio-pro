import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  handlePaymentSucceeded,
  handleChargeRefunded,
  handleDisputeCreated,
} from '@/lib/admin/webhooks/stripe-processor'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

// POST — Stripe webhook endpoint (public, no auth — signature verified)
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  // Verify Stripe signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    return NextResponse.json({ error: `Signature failed: ${msg}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency via webhook_events table
  const payloadHash = crypto.createHash('sha256').update(body).digest('hex')
  const { data: inserted, error: insertError } = await admin
    .from('webhook_events')
    .insert({
      provider: 'stripe',
      event_id: event.id,
      event_type: event.type,
      payload: event.data.object as unknown as Record<string, string>,
      payload_hash: payloadHash,
      processing_status: 'processing',
    })
    .select('id')
    .single()

  if (insertError) {
    // Duplicate event (unique constraint on provider+event_id)
    if (insertError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const webhookEventId = inserted.id

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice, webhookEventId)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(charge, webhookEventId)
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeCreated(dispute, webhookEventId)
        break
      }

      default:
        // Unhandled — mark completed
        break
    }

    await admin
      .from('webhook_events')
      .update({ processing_status: 'completed', processed_at: new Date().toISOString() })
      .eq('id', webhookEventId)

    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Handler error'
    await admin
      .from('webhook_events')
      .update({ processing_status: 'failed', error_message: msg })
      .eq('id', webhookEventId)

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
