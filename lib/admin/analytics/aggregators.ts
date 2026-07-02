/**
 * Analytics aggregation helpers — shared by API routes.
 * Uses single queries per metric to avoid N+1.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// --- Funnel ---

export interface FunnelStage {
  stage: string
  count: number
  pct: number
}

const FUNNEL_STAGES = [
  'cold', 'queued', 'contacted', 'opened', 'replied',
  'interested', 'demo_sent', 'evaluating', 'onboarded', 'active', 'paying',
] as const

export async function buildAcquisitionFunnel(admin: SupabaseClient): Promise<FunnelStage[]> {
  const { data } = await admin
    .from('influencers')
    .select('status')

  if (!data) return []

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.status] = (counts[row.status] || 0) + 1
  }

  // Cumulative: each stage includes all subsequent stages
  const stages: FunnelStage[] = []
  let cumulative = 0
  const orderedCounts: number[] = []

  for (const stage of FUNNEL_STAGES) {
    orderedCounts.push(counts[stage] || 0)
  }

  // Bottom-up cumulative
  const cumulativeCounts: number[] = new Array(orderedCounts.length).fill(0)
  cumulative = 0
  for (let i = orderedCounts.length - 1; i >= 0; i--) {
    cumulative += orderedCounts[i]
    cumulativeCounts[i] = cumulative
  }

  const total = cumulativeCounts[0] || 1
  for (let i = 0; i < FUNNEL_STAGES.length; i++) {
    stages.push({
      stage: FUNNEL_STAGES[i],
      count: cumulativeCounts[i],
      pct: Math.round((cumulativeCounts[i] / total) * 100),
    })
  }

  return stages
}

// --- Revenue ---

export interface RevenueMetrics {
  mrr: number
  arr: number
  totalCustomers: number
  planBreakdown: { plan: string; count: number; mrr: number }[]
}

// Source de verite = montant Stripe reel (gere les prix launch/regular)
// Fallback si subscription_amount_cents est null (pre-migration)
const PLAN_FALLBACK_CENTS: Record<string, number> = {
  free: 0,
  pro: 1900,    // $19 (prix reel)
  studio: 2400, // $24 (prix launch)
}

export async function computeRevenue(admin: SupabaseClient): Promise<RevenueMetrics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('profiles')
    .select('plan, subscription_amount_cents')

  if (!data) return { mrr: 0, arr: 0, totalCustomers: 0, planBreakdown: [] }

  const planAgg: Record<string, { count: number; totalCents: number }> = {}

  for (const row of data as { plan: string | null; subscription_amount_cents: number | null }[]) {
    const p = row.plan || 'free'
    if (!planAgg[p]) planAgg[p] = { count: 0, totalCents: 0 }
    planAgg[p].count++
    // Use real Stripe amount if available, else fallback
    const cents = row.subscription_amount_cents ?? PLAN_FALLBACK_CENTS[p] ?? 0
    planAgg[p].totalCents += cents
  }

  let mrr = 0
  const planBreakdown = Object.entries(planAgg).map(([plan, agg]) => {
    mrr += agg.totalCents
    return { plan, count: agg.count, mrr: agg.totalCents }
  })

  const totalCustomers = Object.entries(planAgg)
    .filter(([p]) => p !== 'free')
    .reduce((s, [, a]) => s + a.count, 0)

  return {
    mrr,
    arr: mrr * 12,
    totalCustomers,
    planBreakdown: planBreakdown.sort((a, b) => b.mrr - a.mrr),
  }
}

// --- Affiliate leaderboard ---

export interface AffiliateRanking {
  id: string
  name: string
  handle: string
  platform: string | null
  total_conversions: number
  total_revenue_cents: number
  commission_earned_cents: number
  conversion_rate: number
  tier: 'bronze' | 'silver' | 'gold'
  status: string
}

export async function getAffiliateLeaderboard(admin: SupabaseClient): Promise<AffiliateRanking[]> {
  // Real system: influencers with affiliate_codes + referrals + commission ledger
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: influencers } = await (admin as any)
    .from('influencers')
    .select('id, display_name, platform_handle, primary_platform, status, affiliate_code')
    .not('affiliate_code', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (!influencers || influencers.length === 0) {
    // Fallback: try legacy affiliates table
    const { data: legacy } = await admin
      .from('affiliates')
      .select('id, name, handle, platform, total_signups, total_conversions, total_revenue_cents, total_commission_earned, status')
      .eq('status', 'active')
      .order('total_revenue_cents', { ascending: false })
      .limit(20)

    if (!legacy) return []
    return legacy.map(a => {
      const conversions = a.total_conversions ?? 0
      const tier: 'bronze' | 'silver' | 'gold' = conversions >= 21 ? 'gold' : conversions >= 6 ? 'silver' : 'bronze'
      return {
        id: a.id, name: a.name, handle: a.handle, platform: a.platform,
        total_conversions: conversions,
        total_revenue_cents: a.total_revenue_cents ?? 0,
        commission_earned_cents: a.total_commission_earned ?? 0,
        conversion_rate: (a.total_signups && a.total_signups > 0) ? Math.round((conversions / a.total_signups) * 100) : 0,
        tier, status: a.status,
      }
    })
  }

  // Build leaderboard from real influencer data
  const results: AffiliateRanking[] = []
  for (const inf of influencers as { id: string; display_name: string; platform_handle: string; primary_platform: string | null; status: string; affiliate_code: string }[]) {
    // Count paying referrals
    const { count: payingCount } = await admin
      .from('affiliate_referrals')
      .select('id', { count: 'exact', head: true })
      .eq('influencer_id', inf.id)
      .eq('status', 'paying')

    // Sum commissions + revenue from ledger
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ledgerAgg } = await (admin as any)
      .from('affiliate_commission_ledger')
      .select('amount_cents, event_type')
      .eq('influencer_id', inf.id)

    let totalCommission = 0
    let totalRevenue = 0
    for (const entry of ledgerAgg ?? []) {
      if (entry.event_type === 'commission') {
        totalCommission += entry.amount_cents ?? 0
        totalRevenue += (entry.amount_cents ?? 0) * 3 // ~30% commission → ~3x = revenue
      }
    }

    const conversions = payingCount ?? 0
    const tier: 'bronze' | 'silver' | 'gold' = conversions >= 21 ? 'gold' : conversions >= 6 ? 'silver' : 'bronze'

    results.push({
      id: inf.id,
      name: inf.display_name || inf.platform_handle,
      handle: inf.platform_handle,
      platform: inf.primary_platform,
      total_conversions: conversions,
      total_revenue_cents: totalRevenue,
      commission_earned_cents: totalCommission,
      conversion_rate: 0, // no click tracking yet at this level
      tier,
      status: inf.status,
    })
  }

  return results.sort((a, b) => b.total_revenue_cents - a.total_revenue_cents).slice(0, 20)
}

// --- Campaign performance ---

export interface CampaignPerf {
  id: string
  name: string
  status: string
  total_recipients: number
  total_sent: number
  total_opened: number
  total_replied: number
  total_bounced: number
  total_converted: number
  open_rate: number
  reply_rate: number
  bounce_rate: number
  conversion_rate: number
}

export async function getCampaignPerformance(admin: SupabaseClient): Promise<CampaignPerf[]> {
  const { data } = await admin
    .from('email_campaigns')
    .select('id, name, status, total_recipients, total_sent, total_opened, total_replied, total_bounced, total_converted, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!data) return []

  return data.map(c => {
    const sent = c.total_sent || 1
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      total_recipients: c.total_recipients ?? 0,
      total_sent: c.total_sent ?? 0,
      total_opened: c.total_opened ?? 0,
      total_replied: c.total_replied ?? 0,
      total_bounced: c.total_bounced ?? 0,
      total_converted: c.total_converted ?? 0,
      open_rate: Math.round(((c.total_opened ?? 0) / sent) * 100),
      reply_rate: Math.round(((c.total_replied ?? 0) / sent) * 100),
      bounce_rate: Math.round(((c.total_bounced ?? 0) / sent) * 100),
      conversion_rate: Math.round(((c.total_converted ?? 0) / sent) * 100),
    }
  })
}

// --- Cohort analysis ---

export interface CohortRow {
  cohort: string // "2026-01"
  total: number
  active_m1: number
  active_m2: number
  active_m3: number
  active_m6: number
}

export async function getCohorts(admin: SupabaseClient): Promise<CohortRow[]> {
  const { data } = await admin
    .from('influencers')
    .select('created_at, status, last_active_at')
    .in('status', ['onboarded', 'active', 'paying', 'dormant', 'declined'])

  if (!data) return []

  const cohorts: Record<string, { total: number; activeByMonth: Record<number, number> }> = {}

  for (const inf of data) {
    const created = new Date(inf.created_at)
    const cohortKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`

    if (!cohorts[cohortKey]) {
      cohorts[cohortKey] = { total: 0, activeByMonth: {} }
    }
    cohorts[cohortKey].total++

    if (inf.last_active_at) {
      const lastActive = new Date(inf.last_active_at)
      const monthsDiff = Math.floor(
        (lastActive.getTime() - created.getTime()) / (30 * 24 * 60 * 60 * 1000)
      )
      for (let m = 1; m <= Math.min(monthsDiff, 6); m++) {
        cohorts[cohortKey].activeByMonth[m] = (cohorts[cohortKey].activeByMonth[m] || 0) + 1
      }
    }
  }

  return Object.entries(cohorts)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([cohort, data]) => ({
      cohort,
      total: data.total,
      active_m1: data.activeByMonth[1] || 0,
      active_m2: data.activeByMonth[2] || 0,
      active_m3: data.activeByMonth[3] || 0,
      active_m6: data.activeByMonth[6] || 0,
    }))
}
