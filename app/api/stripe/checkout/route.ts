import { NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

const PRICE_IDS: Record<string, string> = {
  pro:    process.env.STRIPE_PRICE_PRO    ?? 'price_pro_placeholder',
  studio: process.env.STRIPE_PRICE_STUDIO ?? 'price_studio_placeholder',
}

const bodySchema = z.object({
  plan: z.enum(['pro', 'studio']),
})

// 7-day free trial on Pro only (Studio is explicitly a committed tier).
// Null means "no trial" — Stripe rejects 0.
const TRIAL_DAYS: Record<'pro' | 'studio', number | null> = {
  pro: 7,
  studio: null,
}

export const POST = withAuth(async (req, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps invalide' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Plan invalide' }, { status: 400 })
  }

  const { plan } = parsed.data
  const stripe = getStripe()
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Fetch existing Stripe customer ID if any
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  try {
    let customerId = profile?.stripe_customer_id ?? undefined

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email ?? undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id

      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const trialDays = TRIAL_DAYS[plan]

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${appUrl}/settings?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/settings?checkout=cancel`,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id, plan },
        ...(trialDays
          ? {
              trial_period_days: trialDays,
              // If the card ever fails at the end of the trial, don't
              // silently cancel — pause the sub so the user gets a clear
              // "payment failed" mail and can fix it.
              trial_settings: {
                end_behavior: { missing_payment_method: 'pause' },
              },
            }
          : {}),
      },
    })

    return NextResponse.json({ data: { url: session.url }, error: null, message: 'Session created' })
  } catch (err) {
    // Don't leak Stripe internal error details to the client
    console.error('[stripe/checkout] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { data: null, error: 'Stripe error', message: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
})
