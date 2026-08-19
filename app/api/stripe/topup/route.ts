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

function getPackPrices(): Record<string, { priceId: string; clips: number }> {
  const pack5 = process.env.STRIPE_PRICE_PACK5
  const pack10 = process.env.STRIPE_PRICE_PACK10
  if (!pack5) throw new Error('Stripe not configured: STRIPE_PRICE_PACK5 missing')
  if (!pack10) throw new Error('Stripe not configured: STRIPE_PRICE_PACK10 missing')
  return {
    pack5:  { priceId: pack5,  clips: 5  },
    pack10: { priceId: pack10, clips: 10 },
  }
}

const bodySchema = z.object({
  pack: z.enum(['pack5', 'pack10']),
})

export const POST = withAuth(async (req, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Invalid body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Invalid pack' }, { status: 400 })
  }

  const { pack } = parsed.data
  const packConfig = getPackPrices()[pack]
  const stripe = getStripe()
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  try {
    let customerId = profile?.stripe_customer_id ?? undefined

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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: packConfig.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?topup=success&clips=${packConfig.clips}`,
      cancel_url: `${appUrl}/dashboard?topup=cancel`,
      metadata: {
        user_id: user.id,
        pack,
        bonus_clips: String(packConfig.clips),
        type: 'topup',
      },
    })

    return NextResponse.json({ data: { url: session.url }, error: null, message: 'Session created' })
  } catch (err) {
    logger.error('[stripe/topup] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { data: null, error: 'Stripe error', message: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
})
