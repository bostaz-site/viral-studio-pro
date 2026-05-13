import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Handle account.updated webhook — Stripe Connect KYC status changes.
 * Updates influencer's Connect status fields.
 */
export async function handleAccountUpdated(
  account: Stripe.Account,
): Promise<void> {
  const admin = createAdminClient()

  // Find influencer by Connect account ID
  const { data: influencer } = await admin
    .from('influencers')
    .select('id, stripe_connect_status, stripe_connect_charges_enabled, stripe_connect_payouts_enabled')
    .eq('stripe_connect_account_id', account.id)
    .maybeSingle()

  if (!influencer) return

  const chargesEnabled = account.charges_enabled ?? false
  const payoutsEnabled = account.payouts_enabled ?? false

  // Determine new status
  let newStatus: string = influencer.stripe_connect_status || 'pending_kyc'
  if (chargesEnabled && payoutsEnabled) {
    newStatus = 'active'
  } else if (account.requirements?.disabled_reason) {
    const reason = account.requirements.disabled_reason
    if (reason.includes('rejected')) {
      newStatus = 'rejected'
    } else {
      newStatus = 'restricted'
    }
  } else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
    newStatus = 'pending_kyc'
  }

  const updates: Record<string, unknown> = {
    stripe_connect_status: newStatus,
    stripe_connect_charges_enabled: chargesEnabled,
    stripe_connect_payouts_enabled: payoutsEnabled,
  }

  // Mark onboarded timestamp on first successful KYC
  if (chargesEnabled && payoutsEnabled && !influencer.stripe_connect_charges_enabled) {
    updates.stripe_connect_onboarded_at = new Date().toISOString()
  }

  await admin
    .from('influencers')
    .update(updates)
    .eq('id', influencer.id)
}

/**
 * Handle transfer.paid webhook — mark payout as sent.
 */
export async function handleTransferPaid(
  transfer: Stripe.Transfer,
): Promise<void> {
  if (!transfer.id) return

  const admin = createAdminClient()

  const { data: payout } = await admin
    .from('affiliate_payouts')
    .select('id, influencer_id')
    .eq('stripe_transfer_id', transfer.id)
    .maybeSingle()

  if (!payout) return

  await admin
    .from('affiliate_payouts')
    .update({
      status: 'sent',
      stripe_transfer_status: 'paid',
      sent_at: new Date().toISOString(),
    })
    .eq('id', payout.id)

  // Send confirmation email
  const { data: influencer } = await admin
    .from('influencers')
    .select('email, first_name, display_name')
    .eq('id', payout.influencer_id)
    .single()

  if (!influencer) return
  await sendPayoutConfirmationEmail(influencer, transfer.amount)
}

/**
 * Handle transfer.failed webhook — mark payout as failed.
 */
export async function handleTransferFailed(
  transfer: Stripe.Transfer,
): Promise<void> {
  if (!transfer.id) return

  const admin = createAdminClient()

  await admin
    .from('affiliate_payouts')
    .update({
      status: 'failed',
      stripe_transfer_status: 'failed',
      failure_reason: 'Stripe transfer failed',
    })
    .eq('stripe_transfer_id', transfer.id)
}

async function sendPayoutConfirmationEmail(
  influencer: { email: string; first_name: string | null; display_name: string | null },
  amountCents: number,
): Promise<void> {
  const name = influencer.first_name || influencer.display_name || 'Partner'
  const amount = (amountCents / 100).toFixed(2)
  const resendKey = process.env.RESEND_API_KEY

  if (!resendKey) {
    console.warn(`[payout-email] No RESEND_API_KEY — payout $${amount} sent to ${influencer.email}`)
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
      subject: `Your $${amount} payout has been sent!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f5f5f5;">Payout sent, ${name}!</h2>
          <p style="color: #a1a1aa;">We've just sent <strong style="color: #f59e0b;">$${amount}</strong> to your connected bank account via Stripe.</p>
          <p style="color: #a1a1aa;">It usually takes 2-3 business days to arrive. You can check your payout history in your partner dashboard.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'}/partner" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
            View Dashboard
          </a>
          <p style="color: #71717a; font-size: 12px;">Keep referring creators to earn more! — Viral Animal Team</p>
        </div>
      `,
    }),
  })
}
