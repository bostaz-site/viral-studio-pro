/**
 * The Revenue Agent — runs SUNDAY night
 *
 * CFO + growth strategist that analyzes where revenue comes from,
 * detects founder-time vs revenue mismatches, and proposes MAX 3
 * moves with hard $ ROI estimates.
 *
 * Run: npx tsx scripts/audits/revenue-agent.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { runStrategicAgent } from '../../lib/audit/strategic-runner'
import Stripe from 'stripe'

export async function runRevenueAgent() {
  console.log('[revenue] Starting...')
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Stripe data (if key available)
  let stripeData: Record<string, unknown> = {}
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && !stripeKey.includes('placeholder')) {
    try {
      const stripe = new Stripe(stripeKey)

      // Active subscriptions
      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 })
      const planDistribution: Record<string, number> = {}
      let mrr = 0
      for (const sub of subs.data) {
        const plan = (sub.items.data[0]?.price?.nickname ?? sub.items.data[0]?.price?.id ?? 'unknown').toLowerCase()
        planDistribution[plan] = (planDistribution[plan] ?? 0) + 1
        mrr += (sub.items.data[0]?.price?.unit_amount ?? 0) / 100
      }

      // Recent charges (last 30 days)
      const charges = await stripe.charges.list({
        created: { gte: Math.floor(Date.now() / 1000) - 30 * 86400 },
        limit: 100,
      })
      const revenue30d = charges.data
        .filter((c) => c.paid && !c.refunded)
        .reduce((sum, c) => sum + c.amount / 100, 0)

      // Churn: canceled subscriptions last 30d
      const canceled = await stripe.subscriptions.list({
        status: 'canceled',
        created: { gte: Math.floor(Date.now() / 1000) - 30 * 86400 },
        limit: 100,
      })

      stripeData = {
        active_subscriptions: subs.data.length,
        mrr,
        plan_distribution: planDistribution,
        revenue_30d: revenue30d,
        churned_30d: canceled.data.length,
        churn_rate_30d: subs.data.length > 0
          ? ((canceled.data.length / (subs.data.length + canceled.data.length)) * 100).toFixed(1) + '%'
          : 'N/A',
      }
      console.log(`[revenue] Stripe: ${subs.data.length} active subs, $${mrr.toFixed(0)} MRR`)
    } catch (err) {
      console.warn('[revenue] Stripe API failed:', err instanceof Error ? err.message : err)
      stripeData = { error: 'Stripe API call failed' }
    }
  } else {
    console.warn('[revenue] STRIPE_SECRET_KEY not set — using DB-only data')
    stripeData = { note: 'No Stripe key configured' }
  }

  // 2. User activity: renders by plan
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, plan, monthly_videos_used, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const planUsage: Record<string, { count: number; avgVideos: number }> = {}
  for (const p of profiles ?? []) {
    const plan = p.plan ?? 'free'
    if (!planUsage[plan]) planUsage[plan] = { count: 0, avgVideos: 0 }
    planUsage[plan].count++
    planUsage[plan].avgVideos += p.monthly_videos_used ?? 0
  }
  for (const plan of Object.keys(planUsage)) {
    planUsage[plan].avgVideos = planUsage[plan].count > 0
      ? Math.round(planUsage[plan].avgVideos / planUsage[plan].count)
      : 0
  }

  // 3. Feature usage signals (render jobs by source)
  const { data: renderJobs } = await admin
    .from('render_jobs')
    .select('source, status, created_at')
    .gte('created_at', thirtyDaysAgo)

  const featureUsage: Record<string, number> = {}
  for (const job of renderJobs ?? []) {
    const src = job.source ?? 'unknown'
    featureUsage[src] = (featureUsage[src] ?? 0) + 1
  }

  // 4. Conversion funnel: signups → first render → paid
  const { count: signups7d } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { count: rendered7d } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'done')
    .gte('created_at', sevenDaysAgo)

  const { count: paidUsers } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .neq('plan', 'free')

  // 5. Affiliate revenue
  const { data: affiliateStats } = await admin
    .from('affiliate_codes')
    .select('code, clicks, signups, conversions, total_earned')
    .gt('clicks', 0)
    .order('total_earned', { ascending: false })
    .limit(10)

  const result = await runStrategicAgent({
    agent_type: 'revenue',
    persona_prompt: 'a CFO + growth strategist obsessed with revenue per feature. You cut through founder bias with data. You say things like "You love Browse, but Distribution prints money." Every recommendation comes with a $ estimate.',
    inputs: {
      stripe: stripeData,
      user_plans: planUsage,
      feature_usage_30d: featureUsage,
      funnel_7d: {
        signups: signups7d ?? 0,
        renders_completed: rendered7d ?? 0,
        paid_users_total: paidUsers ?? 0,
      },
      affiliate_performance: affiliateStats ?? [],
      question: 'Where does revenue actually come from? Where is founder time going vs where revenue is? What should be doubled down on vs cut?',
    },
  })

  console.log(`[revenue] Done. ${result.top_moves.length} moves proposed.`)
}

if (typeof require !== 'undefined' && require.main === module) {
  runRevenueAgent()
    .then(() => process.exit(0))
    .catch((err) => { console.error('[revenue] Fatal:', err); process.exit(1) })
}
