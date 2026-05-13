/**
 * Cost calculator — auto-compute costs from DB tables + manual entries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface MonthlyCosts {
  month: string // "2026-05"
  auto: {
    anthropic_api: number     // from ai_calls
    stripe_fees: number       // 2.9% + 30c per transaction (estimate from MRR)
    affiliate_commissions: number // from affiliate_commission_ledger
  }
  manual: {
    category: string
    vendor: string
    amount_cents: number
  }[]
  total_auto: number
  total_manual: number
  total: number
}

export interface PnLView {
  revenue_cents: number
  stripe_fees: number
  commissions: number
  infra: number
  tools: number
  other: number
  net_profit: number
}

export async function computeMonthlyCosts(
  admin: SupabaseClient,
  month: string // "2026-05"
): Promise<MonthlyCosts> {
  const startDate = `${month}-01`
  const endDate = nextMonth(month)

  // 1. Anthropic API costs (ai_calls)
  const { data: aiCosts } = await admin
    .from('ai_calls' as never)
    .select('cost_usd')
    .gte('created_at', startDate)
    .lt('created_at', endDate)

  const anthropicCents = Math.round(
    ((aiCosts as { cost_usd: number }[] | null) ?? [])
      .reduce((sum, row) => sum + (Number(row.cost_usd) || 0), 0) * 100
  )

  // 2. Estimate Stripe fees (2.9% + 30c per paying customer)
  const { data: profiles } = await admin
    .from('profiles')
    .select('plan')
    .neq('plan', 'free')

  const planPrices: Record<string, number> = { pro: 2900, studio: 4900 }
  let mrrCents = 0
  let payingCount = 0
  for (const p of profiles ?? []) {
    mrrCents += planPrices[p.plan] ?? 0
    payingCount++
  }
  const stripeFees = Math.round(mrrCents * 0.029 + payingCount * 30)

  // 3. Affiliate commissions this month
  const { data: commissions } = await admin
    .from('affiliate_commission_ledger' as never)
    .select('amount_cents')
    .eq('event_type', 'payment_earned')
    .gte('created_at', startDate)
    .lt('created_at', endDate)

  const commissionCents = ((commissions as { amount_cents: number }[] | null) ?? [])
    .reduce((sum, row) => sum + (Number(row.amount_cents) || 0), 0)

  // 4. Manual costs
  const { data: manualCosts } = await admin
    .from('costs_manual')
    .select('category, vendor, amount_cents')
    .gte('billing_period_start', startDate)
    .lt('billing_period_start', endDate)

  const manual = (manualCosts ?? []).map(c => ({
    category: c.category,
    vendor: c.vendor,
    amount_cents: c.amount_cents,
  }))

  const totalManual = manual.reduce((s, c) => s + c.amount_cents, 0)
  const totalAuto = anthropicCents + stripeFees + commissionCents

  return {
    month,
    auto: {
      anthropic_api: anthropicCents,
      stripe_fees: stripeFees,
      affiliate_commissions: commissionCents,
    },
    manual,
    total_auto: totalAuto,
    total_manual: totalManual,
    total: totalAuto + totalManual,
  }
}

export async function computePnL(
  admin: SupabaseClient,
  month: string
): Promise<PnLView> {
  const costs = await computeMonthlyCosts(admin, month)

  // Revenue = MRR from profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('plan')
    .neq('plan', 'free')

  const planPrices: Record<string, number> = { pro: 2900, studio: 4900 }
  const revenueCents = (profiles ?? []).reduce((s, p) => s + (planPrices[p.plan] ?? 0), 0)

  // Group manual costs by category
  const manualByCategory: Record<string, number> = {}
  for (const c of costs.manual) {
    manualByCategory[c.category] = (manualByCategory[c.category] || 0) + c.amount_cents
  }

  return {
    revenue_cents: revenueCents,
    stripe_fees: costs.auto.stripe_fees,
    commissions: costs.auto.affiliate_commissions,
    infra: (manualByCategory['infra'] || 0) + costs.auto.anthropic_api,
    tools: manualByCategory['tools'] || 0,
    other: Object.entries(manualByCategory)
      .filter(([cat]) => !['infra', 'tools'].includes(cat))
      .reduce((s, [, v]) => s + v, 0),
    net_profit: revenueCents - costs.total,
  }
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (m === 12) return `${y + 1}-01-01`
  return `${y}-${String(m + 1).padStart(2, '0')}-01`
}
