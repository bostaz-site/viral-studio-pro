import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

export const POST = withAuth(async (req, user) => {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { data: null, error: 'No subscription', message: 'No active subscription found' },
      { status: 404 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const portalStripe = getStripe()
    const session = await portalStripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    })

    return NextResponse.json({ data: { url: session.url }, error: null, message: 'Portal created' })
  } catch (err) {
    // Don't leak Stripe internal error details to the client
    const isStripeError = err instanceof Error && err.message.includes('Stripe')
    return NextResponse.json(
      { data: null, error: 'Stripe error', message: isStripeError ? 'Failed to create portal' : 'Internal error' },
      { status: 500 }
    )
  }
})

// NOTE: No GET export — portal creation must be POST-only to prevent CSRF

