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

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 2900,    // $29
  studio: 4900, // $49
}

export async function computeRevenue(admin: SupabaseClient): Promise<RevenueMetrics> {
  const { data } = await admin
    .from('profiles')
    .select('plan')

  if (!data) return { mrr: 0, arr: 0, totalCustomers: 0, planBreakdown: [] }

  const planCounts: Record<string, number> = {}
  for (const row of data) {
    const p = row.plan || 'free'
    planCounts[p] = (planCounts[p] || 0) + 1
  }

  let mrr = 0
  const planBreakdown = Object.entries(planCounts).map(([plan, count]) => {
    const price = PLAN_PRICES[plan] ?? 0
    const planMrr = price * count
    mrr += planMrr
    return { plan, count, mrr: planMrr }
  })

  const totalCustomers = Object.entries(planCounts)
    .filter(([p]) => p !== 'free')
    .reduce((s, [, c]) => s + c, 0)

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
  const { data } = await admin
    .from('affiliates')
    .select('id, name, handle, platform, total_signups, total_conversions, total_revenue_cents, total_commission_earned, status')
    .eq('status', 'active')
    .order('total_revenue_cents', { ascending: false })
    .limit(20)

  if (!data) return []

  return data.map(a => {
    const conversions = a.total_conversions ?? 0
    const tier = conversions >= 21 ? 'gold' : conversions >= 6 ? 'silver' : 'bronze'

    return {
      id: a.id,
      name: a.name,
      handle: a.handle,
      platform: a.platform,
      total_conversions: conversions,
      total_revenue_cents: a.total_revenue_cents ?? 0,
      commission_earned_cents: a.total_commission_earned ?? 0,
      conversion_rate: (a.total_signups && a.total_signups > 0)
        ? Math.round((conversions / a.total_signups) * 100) : 0,
      tier,
      status: a.status,
    }
  })
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
