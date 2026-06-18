/**
 * The Strategist — runs SUNDAY night
 *
 * Reads last 7 days of audit findings, funnel metrics, and user feedback
 * to propose MAX 3 compound strategic moves for the week ahead.
 *
 * Run: npx tsx scripts/audits/strategist.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { runStrategicAgent } from '../../lib/audit/strategic-runner'

export async function runStrategist() {
  console.log('[strategist] Starting...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Last 7 days of audit findings (all agents)
  const { data: recentFindings } = await admin
    .from('audit_findings')
    .select('id, agent_type, severity, title, description, status, cycle_count')
    .gte('created_at', sevenDaysAgo)
    .order('severity', { ascending: true })
    .limit(30)

  // 2. Open critical/high findings
  const { data: openCritical } = await admin
    .from('audit_findings')
    .select('id, agent_type, title, description, cycle_count')
    .eq('status', 'open')
    .in('severity', ['critical', 'high'])
    .order('cycle_count', { ascending: false })
    .limit(10)

  // 3. KPI metrics (last 7 days)
  const { data: metrics } = await admin
    .from('audit_metrics_snapshots')
    .select('metric_name, metric_value, snapshot_date')
    .gte('snapshot_date', sevenDaysAgo.slice(0, 10))
    .order('snapshot_date', { ascending: false })

  // 4. Last week's strategic moves — what was shipped?
  const lastMonday = new Date()
  lastMonday.setDate(lastMonday.getDate() - ((lastMonday.getDay() + 6) % 7) - 7)
  const lastWeekOf = lastMonday.toISOString().slice(0, 10)

  const { data: lastWeekMoves } = await admin
    .from('strategic_moves')
    .select('title, status, shipped_at, outcome_metric, outcome_value')
    .eq('proposed_week_of', lastWeekOf)
    .neq('status', 'parked')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shippedCount = (lastWeekMoves ?? []).filter((m: any) => m.status === 'shipped').length
  const totalCount = (lastWeekMoves ?? []).length

  // 5. User/revenue signals
  const { data: recentRenders } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { data: recentSignups } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const result = await runStrategicAgent({
    agent_type: 'strategist',
    persona_prompt: 'a senior product strategist who shipped Stripe Connect, Linear, and Notion. You obsess over compound moves: one decision that unlocks 3 things at once. You hate scattered priorities.',
    inputs: {
      recent_findings: recentFindings ?? [],
      open_critical_findings: openCritical ?? [],
      kpi_metrics_7d: metrics ?? [],
      last_week_moves: {
        shipped: shippedCount,
        total: totalCount,
        details: lastWeekMoves ?? [],
      },
      activity_7d: {
        renders: recentRenders?.length ?? 0,
        signups: recentSignups?.length ?? 0,
      },
    },
  })

  console.log(`[strategist] Done. ${result.top_moves.length} moves proposed.`)
}

if (typeof require !== 'undefined' && require.main === module) {
  runStrategist()
    .then(() => process.exit(0))
    .catch((err) => { console.error('[strategist] Fatal:', err); process.exit(1) })
}
