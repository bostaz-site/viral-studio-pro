import { NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'
import { logger } from '@/lib/logger'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe not configured: STRIPE_SECRET_KEY missing')
  return new Stripe(key)
}

function getPriceIds(): Record<string, string> {
  const pro = process.env.STRIPE_PRICE_PRO
  const studio = process.env.STRIPE_PRICE_STUDIO
  if (!pro) throw new Error('Stripe not configured: STRIPE_PRICE_PRO missing')
  if (!studio) throw new Error('Stripe not configured: STRIPE_PRICE_STUDIO missing')
  return { pro, studio }
}

const bodySchema = z.object({
  plan: z.enum(['pro', 'studio']),
  promo_code: z.string().max(30).optional(),
})

// Freemium model — no trial period on any tier.
// Users start free and upgrade when ready.
const TRIAL_DAYS: Record<'pro' | 'studio', number | null> = {
  pro: null,
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

  const { plan, promo_code } = parsed.data
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

    // If promo code provided, look up Stripe promotion codes.
    // Check affiliates table first (affiliate codes), then fall back to
    // Stripe directly (non-affiliate promos like BETA40).
    let discounts: { promotion_code: string }[] | undefined
    if (promo_code) {
      try {
        const promoCodes = await stripe.promotionCodes.list({
          code: promo_code.toUpperCase(),
          active: true,
          limit: 1,
        })
        if (promoCodes.data.length > 0) {
          discounts = [{ promotion_code: promoCodes.data[0].id }]
        }
      } catch {
        // Stripe promo code not found — proceed without discount
      }
    }

    const priceIds = getPriceIds()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card', 'link'],
      line_items: [{ price: priceIds[plan], quantity: 1 }],
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      success_url: `${appUrl}/settings?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/settings?checkout=cancel`,
      metadata: { user_id: user.id, plan, ...(promo_code ? { promo_code: promo_code.toUpperCase() } : {}) },
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
    logger.error('[stripe/checkout] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { data: null, error: 'Stripe error', message: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
})
