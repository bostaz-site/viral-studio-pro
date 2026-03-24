import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

export async function POST() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { data: null, error: 'No subscription', message: 'Aucun abonnement actif trouvé' },
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

    return NextResponse.json({ data: { url: session.url }, error: null, message: 'Portal créé' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Stripe Portal'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}

export { POST as GET }

