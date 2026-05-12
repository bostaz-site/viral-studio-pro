import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const COMMISSION_RATE = 0.30 // 30% lifetime

/**
 * Process invoice.payment_succeeded → insert commission ledger entry.
 */
export async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  webhookEventId: string,
): Promise<void> {
  const supabase = createAdminClient()

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  const amountCents = invoice.amount_paid
  if (!amountCents || amountCents <= 0) return

  // Find user by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!profile) return

  // Find referral for this user
  const { data: referral } = await supabase
    .from('affiliate_referrals')
    .select('id, influencer_id, status')
    .eq('user_id', profile.id)
    .in('status', ['signed_up', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!referral) return

  // Mark referral as active + update revenue
  if (referral.status !== 'active') {
    await supabase
      .from('affiliate_referrals')
      .update({
        status: 'active',
        first_paid_at: new Date().toISOString(),
      })
      .eq('id', referral.id)
      .is('first_paid_at', null)
  }

  // Calculate commission
  const commissionCents = Math.round(amountCents * COMMISSION_RATE)

  // INSERT into immutable commission ledger (service_role bypasses RLS)
  await supabase.from('affiliate_commission_ledger').insert({
    influencer_id: referral.influencer_id,
    referral_id: referral.id,
    user_id: profile.id,
    event_type: 'payment_earned',
    amount_cents: commissionCents,
    currency: 'usd',
    stripe_invoice_id: invoice.id,
    stripe_charge_id: null,
    webhook_event_id: webhookEventId,
  })

  // Log activation event
  await supabase.from('product_activation_events').insert({
    user_id: profile.id,
    event_name: 'trial_converted_paid',
    referred_by_influencer_id: referral.influencer_id,
    metadata: { amount_cents: amountCents, commission_cents: commissionCents } as Record<string, number>,
  })
}

/**
 * Process charge.refunded → insert clawback entry in commission ledger.
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge,
  webhookEventId: string,
): Promise<void> {
  const supabase = createAdminClient()

  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
  if (!customerId) return

  const refundAmountCents = charge.amount_refunded
  if (!refundAmountCents || refundAmountCents <= 0) return

  // Find user
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!profile) return

  // Find referral
  const { data: referral } = await supabase
    .from('affiliate_referrals')
    .select('id, influencer_id')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!referral) return

  // Clawback = negative commission
  const clawbackCents = -Math.round(refundAmountCents * COMMISSION_RATE)

  await supabase.from('affiliate_commission_ledger').insert({
    influencer_id: referral.influencer_id,
    referral_id: referral.id,
    user_id: profile.id,
    event_type: 'refund_clawback',
    amount_cents: clawbackCents,
    currency: 'usd',
    stripe_charge_id: charge.id,
    stripe_refund_id: charge.refunds?.data?.[0]?.id ?? null,
    webhook_event_id: webhookEventId,
  })
}

/**
 * Process charge.dispute.created → flag fraud + freeze commissions.
 */
export async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  webhookEventId: string,
): Promise<void> {
  const supabase = createAdminClient()

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
  if (!chargeId) return

  // Find ledger entry by stripe_charge_id
  const { data: ledgerEntry } = await supabase
    .from('affiliate_commission_ledger')
    .select('id, influencer_id, amount_cents')
    .eq('stripe_charge_id', chargeId)
    .eq('event_type', 'payment_earned')
    .maybeSingle()

  if (!ledgerEntry) return

  // Insert chargeback clawback
  await supabase.from('affiliate_commission_ledger').insert({
    influencer_id: ledgerEntry.influencer_id,
    event_type: 'chargeback_clawback',
    amount_cents: -Math.abs(ledgerEntry.amount_cents),
    currency: 'usd',
    stripe_charge_id: chargeId,
    webhook_event_id: webhookEventId,
    notes: `Dispute: ${dispute.reason ?? 'unknown'}`,
  })

  // Create fraud flag
  await supabase.from('fraud_flags').insert({
    influencer_id: ledgerEntry.influencer_id,
    flag_type: 'chargeback_high_rate',
    severity: 'high',
    details: {
      charge_id: chargeId,
      dispute_id: dispute.id,
      reason: dispute.reason ?? 'unknown',
      amount: String(dispute.amount),
    } as Record<string, string>,
  })
}
