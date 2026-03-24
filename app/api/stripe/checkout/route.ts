import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

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
      },
    })

    return NextResponse.json({ data: { url: session.url }, error: null, message: 'Session créée' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Stripe'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}
