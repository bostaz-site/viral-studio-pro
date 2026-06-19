import type { Json } from '../supabase/types'
import { createAdminClient } from '../supabase/admin'
import { insertFinding } from './insert-finding'
import { isPreLaunchMode, isTrafficDependentMetric } from './pre-launch-mode'

export async function insertMetricSnapshot(opts: {
  metric_name: string
  metric_value: number
  metric_unit?: string
  context?: Record<string, Json | undefined>
  regression_threshold_percent?: number
}) {
  if (isPreLaunchMode() && isTrafficDependentMetric(opts.metric_name)) {
    console.log(`[metric] Skipping (PRE_LAUNCH_MODE): ${opts.metric_name}`)
    return
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Upsert snapshot for today
  await admin
    .from('audit_metrics_snapshots')
    .upsert({
      snapshot_date: today,
      metric_name: opts.metric_name,
      metric_value: opts.metric_value,
      metric_unit: opts.metric_unit,
      context: opts.context as Json | undefined,
    }, { onConflict: 'snapshot_date,metric_name' })

  // Regression detection: compare with 5 days ago
  if (opts.regression_threshold_percent) {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: past } = await admin
      .from('audit_metrics_snapshots')
      .select('metric_value')
      .eq('metric_name', opts.metric_name)
      .eq('snapshot_date', fiveDaysAgo)
      .maybeSingle()

    if (past?.metric_value) {
      const pastVal = Number(past.metric_value)
      const percentChange = ((opts.metric_value - pastVal) / pastVal) * 100
      if (percentChange < -opts.regression_threshold_percent) {
        await insertFinding({
          agent_type: 'technical',
          severity: 'critical',
          title: `Regression: ${opts.metric_name} dropped ${Math.abs(percentChange).toFixed(1)}%`,
          description: `Value went from ${pastVal} to ${opts.metric_value} over 5 days`,
          location: opts.metric_name,
        })
      }
    }
  }
}
