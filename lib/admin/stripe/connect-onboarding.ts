import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

/**
 * Create a Stripe Connect Express account for an influencer.
 * Called when admin marks status='onboarded'.
 * Returns the account ID if created, null if already exists.
 */
export async function createConnectAccount(influencerId: string): Promise<string | null> {
  const admin = createAdminClient()

  const { data: influencer } = await admin
    .from('influencers')
    .select('id, email, first_name, last_name, stripe_connect_account_id, stripe_connect_status, country')
    .eq('id', influencerId)
    .single()

  if (!influencer) throw new Error(`Influencer ${influencerId} not found`)

  // Already has a Connect account
  if (influencer.stripe_connect_account_id) {
    return influencer.stripe_connect_account_id
  }

  const stripe = getStripe()

  const account = await stripe.accounts.create({
    type: 'express',
    email: influencer.email,
    country: influencer.country?.toUpperCase() || 'US',
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    individual: {
      email: influencer.email,
      first_name: influencer.first_name || undefined,
      last_name: influencer.last_name || undefined,
    },
    metadata: {
      influencer_id: influencerId,
      source: 'viral_animal_affiliate',
    },
  })

  await admin
    .from('influencers')
    .update({
      stripe_connect_account_id: account.id,
      stripe_connect_status: 'pending_kyc',
    })
    .eq('id', influencerId)

  return account.id
}

/**
 * Generate a Stripe Connect onboarding link for the influencer.
 * The influencer uses this to complete KYC on Stripe's hosted flow.
 */
export async function createOnboardingLink(influencerId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: influencer } = await admin
    .from('influencers')
    .select('stripe_connect_account_id')
    .eq('id', influencerId)
    .single()

  if (!influencer?.stripe_connect_account_id) {
    throw new Error('No Stripe Connect account found — create one first')
  }

  const stripe = getStripe()

  const link = await stripe.accountLinks.create({
    account: influencer.stripe_connect_account_id,
    refresh_url: `${APP_URL}/partner/onboarding?refresh=true`,
    return_url: `${APP_URL}/partner/onboarding?success=true`,
    type: 'account_onboarding',
  })

  return link.url
}

/**
 * Send the onboarding magic link via email (Resend).
 * Includes both partner portal link and Stripe KYC link.
 */
export async function sendOnboardingEmail(
  influencerId: string,
  stripeOnboardingUrl: string,
): Promise<void> {
  const admin = createAdminClient()

  const { data: influencer } = await admin
    .from('influencers')
    .select('email, first_name, display_name')
    .eq('id', influencerId)
    .single()

  if (!influencer) return

  const name = influencer.first_name || influencer.display_name || 'Partner'
  const resendKey = process.env.RESEND_API_KEY

  if (!resendKey) {
    console.warn(`[connect-onboarding] No RESEND_API_KEY — onboarding URL for ${influencer.email}: ${stripeOnboardingUrl}`)
    return
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'Viral Animal <partners@viralanimal.com>',
      to: [influencer.email],
      subject: 'Complete your payment setup — Viral Animal Partner',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f5f5f5;">Welcome aboard, ${name}!</h2>
          <p style="color: #a1a1aa;">You've been accepted into the Viral Animal partner program. To start earning 30% recurring commissions, complete your payment setup with Stripe:</p>
          <a href="${stripeOnboardingUrl}" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
            Complete Payment Setup
          </a>
          <p style="color: #a1a1aa;">Once verified, you'll receive monthly payouts directly to your bank account.</p>
          <p style="color: #71717a; font-size: 12px;">Questions? Reply to this email. — Viral Animal Team</p>
        </div>
      `,
    }),
  })
}
