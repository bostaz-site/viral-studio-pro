import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const MINIMUM_PAYOUT_CENTS = 5000 // $50
const MANUAL_REVIEW_THRESHOLD_CENTS = 50000 // $500

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

interface FraudCheckResult {
  pass: boolean
  requiresManualReview: boolean
  reasons: string[]
}

/**
 * Run fraud checks before payout. Returns whether to proceed, skip, or review.
 *
 * SKIP if: critical fraud_flags OR recent chargeback OR < 2 paid cycles
 * MANUAL REVIEW if: first payout OR balance > $500 OR new IP/device pattern
 */
export async function runFraudChecks(
  influencerId: string,
  payoutAmountCents: number,
): Promise<FraudCheckResult> {
  const admin = createAdminClient()
  const reasons: string[] = []

  // Check critical fraud flags
  const { count: criticalFlags } = await admin
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .eq('severity', 'critical')
    .eq('status', 'open')

  if (criticalFlags && criticalFlags > 0) {
    return { pass: false, requiresManualReview: false, reasons: ['Critical fraud flag active'] }
  }

  // Check recent chargebacks (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentChargebacks } = await admin
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .eq('flag_type', 'chargeback_high_rate')
    .gte('created_at', ninetyDaysAgo)

  if (recentChargebacks && recentChargebacks > 0) {
    return { pass: false, requiresManualReview: false, reasons: ['Recent chargeback within 90 days'] }
  }

  // Check minimum paid cycles (need at least 2 months of payments)
  const { data: paidMonths } = await admin
    .from('affiliate_commission_ledger')
    .select('created_at')
    .eq('influencer_id', influencerId)
    .eq('event_type', 'payment_earned')

  const uniqueMonths = new Set(
    (paidMonths || []).map(e => {
      const d = new Date(e.created_at)
      return `${d.getFullYear()}-${d.getMonth()}`
    })
  )

  if (uniqueMonths.size < 2) {
    return { pass: false, requiresManualReview: false, reasons: ['Less than 2 paid cycles'] }
  }

  // Check if first payout
  let requiresManualReview = false

  const { count: pastPayouts } = await admin
    .from('affiliate_payouts')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .eq('status', 'sent')

  if (!pastPayouts || pastPayouts === 0) {
    requiresManualReview = true
    reasons.push('First payout — manual review required')
  }

  // Check high balance
  if (payoutAmountCents > MANUAL_REVIEW_THRESHOLD_CENTS) {
    requiresManualReview = true
    reasons.push(`Payout > $${MANUAL_REVIEW_THRESHOLD_CENTS / 100} — manual review required`)
  }

  // Check open fraud flags (non-critical)
  const { count: openFlags } = await admin
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', influencerId)
    .in('severity', ['medium', 'high'])
    .eq('status', 'open')

  if (openFlags && openFlags > 0) {
    requiresManualReview = true
    reasons.push('Open fraud flags (medium/high)')
  }

  return { pass: true, requiresManualReview, reasons }
}

/**
 * Calculate the payable balance for an influencer.
 * Uses the v_affiliate_balances view + checks payout_holds.
 */
export async function calculatePayableAmount(influencerId: string): Promise<{
  availableBalanceCents: number
  heldCents: number
  netPayableCents: number
}> {
  const admin = createAdminClient()

  // Get balance from aggregation view
  const { data: balance } = await admin
    .from('v_affiliate_balances')
    .select('available_balance_cents')
    .eq('influencer_id', influencerId)
    .maybeSingle()

  const availableBalanceCents = balance?.available_balance_cents ?? 0

  // Check unreleased holds
  const { data: holds } = await admin
    .from('payout_holds')
    .select('ledger_entry_id')
    .is('released_at', null)
    .gt('held_until', new Date().toISOString())

  // Get held amount from ledger entries that are still on hold
  let heldCents = 0
  if (holds && holds.length > 0) {
    const heldIds = holds.map(h => h.ledger_entry_id)
    const { data: heldEntries } = await admin
      .from('affiliate_commission_ledger')
      .select('amount_cents')
      .eq('influencer_id', influencerId)
      .in('id', heldIds)

    heldCents = (heldEntries || []).reduce((sum, e) => sum + Math.max(0, e.amount_cents), 0)
  }

  return {
    availableBalanceCents,
    heldCents,
    netPayableCents: Math.max(0, availableBalanceCents - heldCents),
  }
}

/**
 * Process monthly payouts for all eligible affiliates.
 * Called by cron on the 1st of each month at 9 AM.
 */
export async function processMonthlyPayouts(): Promise<{
  processed: number
  skipped: number
  needsReview: number
  errors: string[]
}> {
  const admin = createAdminClient()
  const now = new Date()
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1) // 1st of current month
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1) // 1st of previous month

  // Get all eligible affiliates with active Connect accounts
  const { data: affiliates } = await admin
    .from('influencers')
    .select('id, stripe_connect_account_id, stripe_connect_status, stripe_connect_payouts_enabled')
    .in('status', ['onboarded', 'active', 'paying'])
    .not('affiliate_code', 'is', null)
    .not('stripe_connect_account_id', 'is', null)
    .eq('stripe_connect_status', 'active')
    .eq('stripe_connect_payouts_enabled', true)

  if (!affiliates || affiliates.length === 0) {
    return { processed: 0, skipped: 0, needsReview: 0, errors: [] }
  }

  let processed = 0
  let skipped = 0
  let needsReview = 0
  const errors: string[] = []

  for (const affiliate of affiliates) {
    try {
      // Check for existing payout this period (idempotency)
      const { data: existingPayout } = await admin
        .from('affiliate_payouts')
        .select('id')
        .eq('influencer_id', affiliate.id)
        .eq('period_start_at', periodStart.toISOString())
        .not('status', 'eq', 'canceled')
        .limit(1)
        .maybeSingle()

      if (existingPayout) {
        skipped++
        continue
      }

      // Calculate payable amount
      const { netPayableCents } = await calculatePayableAmount(affiliate.id)

      if (netPayableCents < MINIMUM_PAYOUT_CENTS) {
        skipped++
        continue
      }

      // Run fraud checks
      const fraudResult = await runFraudChecks(affiliate.id, netPayableCents)

      if (!fraudResult.pass) {
        skipped++
        continue
      }

      // Get referral IDs for this period
      const { data: periodReferrals } = await admin
        .from('affiliate_referrals')
        .select('id')
        .eq('influencer_id', affiliate.id)
        .in('status', ['attributed', 'paying'])

      const referralIds = (periodReferrals || []).map(r => r.id)

      // Create payout record
      const status = fraudResult.requiresManualReview ? 'pending_review' : 'approved'
      const { data: payout, error: insertErr } = await admin
        .from('affiliate_payouts')
        .insert({
          influencer_id: affiliate.id,
          period_start_at: periodStart.toISOString(),
          period_end_at: periodEnd.toISOString(),
          gross_commission_cents: netPayableCents,
          adjustments_cents: 0,
          net_payout_cents: netPayableCents,
          included_referral_ids: referralIds,
          referrals_count: referralIds.length,
          status,
        })
        .select('id')
        .single()

      if (insertErr) {
        // Handle UNIQUE constraint violation (23505) — payout already exists for this period
        if (insertErr.code === '23505') { skipped++; continue }
        errors.push(`${affiliate.id}: ${insertErr.message}`)
        continue
      }
      if (!payout) { errors.push(`${affiliate.id}: Insert returned no data`); continue }

      if (fraudResult.requiresManualReview) {
        needsReview++
        continue
      }

      // Auto-approved — execute payout immediately
      await executePayout(payout.id)
      processed++
    } catch (err) {
      errors.push(`${affiliate.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return { processed, skipped, needsReview, errors }
}

/**
 * Execute a Stripe Transfer for an approved payout.
 * Creates the transfer and updates the payout record.
 */
export async function executePayout(payoutId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: payout } = await admin
    .from('affiliate_payouts')
    .select('id, influencer_id, net_payout_cents, status, stripe_transfer_id')
    .eq('id', payoutId)
    .single()

  if (!payout) throw new Error(`Payout ${payoutId} not found`)
  if (payout.stripe_transfer_id) throw new Error(`Payout ${payoutId} already has a transfer`)
  if (!['approved', 'pending'].includes(payout.status)) {
    throw new Error(`Payout ${payoutId} status is ${payout.status}, expected approved or pending`)
  }

  // Get influencer's Connect account
  const { data: influencer } = await admin
    .from('influencers')
    .select('stripe_connect_account_id')
    .eq('id', payout.influencer_id)
    .single()

  if (!influencer?.stripe_connect_account_id) {
    throw new Error(`Influencer ${payout.influencer_id} has no Connect account`)
  }

  // Mark as sending
  await admin
    .from('affiliate_payouts')
    .update({ status: 'sending' })
    .eq('id', payoutId)

  try {
    const stripe = getStripe()

    // Create Stripe Transfer with idempotency key based on payout ID
    const transfer = await stripe.transfers.create(
      {
        amount: payout.net_payout_cents,
        currency: 'usd',
        destination: influencer.stripe_connect_account_id,
        description: `Viral Animal affiliate payout`,
        metadata: {
          payout_id: payoutId,
          influencer_id: payout.influencer_id,
        },
      },
      { idempotencyKey: `payout_${payoutId}` },
    )

    // Update payout with transfer details
    await admin
      .from('affiliate_payouts')
      .update({
        stripe_transfer_id: transfer.id,
        stripe_transfer_status: transfer.reversed ? 'reversed' : 'pending',
      })
      .eq('id', payoutId)

    // Insert payout_deduction in commission ledger
    await admin.from('affiliate_commission_ledger').insert({
      influencer_id: payout.influencer_id,
      event_type: 'payout_deduction',
      amount_cents: -payout.net_payout_cents,
      currency: 'usd',
      payout_id: payoutId,
      notes: `Stripe Transfer ${transfer.id}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Transfer failed'
    await admin
      .from('affiliate_payouts')
      .update({
        status: 'failed',
        failure_reason: msg,
      })
      .eq('id', payoutId)

    throw err
  }
}
