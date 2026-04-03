import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

export async function POST(req: NextRequest) {
  // ── Rate limiting (webhook: 100 req/min) ────────────────────────────────
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'stripe-webhook'
  const rl = rateLimit(clientIp, RATE_LIMITS.webhook.limit, RATE_LIMITS.webhook.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  const PLAN_BY_PRICE: Record<string, string> = {
    [process.env.STRIPE_PRICE_PRO    ?? 'price_pro_placeholder']:    'pro',
    [process.env.STRIPE_PRICE_STUDIO ?? 'price_studio_placeholder']: 'studio',
  }
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Idempotency: skip already-processed events ──────────────────────────
  const { data: existingEvent } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (existingEvent) {
    // Already processed — return 200 so Stripe doesn't retry
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan

        if (userId && plan && (plan === 'pro' || plan === 'studio')) {
          await admin
            .from('profiles')
            .update({
              plan,
              stripe_customer_id: session.customer as string,
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        if (!userId) break

        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId ? (PLAN_BY_PRICE[priceId] ?? 'free') : 'free'
        const isActive = ['active', 'trialing'].includes(subscription.status)

        await admin
          .from('profiles')
          .update({ plan: isActive ? plan : 'free' })
          .eq('id', userId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        if (userId) {
          await admin.from('profiles').update({ plan: 'free' }).eq('id', userId)
        }
        break
      }

      case 'invoice.payment_failed': {
        // Optional: notify user of failed payment — for now just log
        break
      }

      default:
        // Unhandled event type — ignore silently
        break
    }

    // ── Record event as processed (idempotency) ─────────────────────────────
    await admin.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
