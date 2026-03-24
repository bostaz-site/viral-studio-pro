import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
