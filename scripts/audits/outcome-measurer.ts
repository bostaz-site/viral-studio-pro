/**
 * Outcome Measurer — runs DAILY at end of nightly
 *
 * For each fix merged exactly 7 days ago, measures the actual metric
 * impact and compares to the ROI prediction. Creates the learning loop.
 *
 * Run: npx tsx scripts/audits/outcome-measurer.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { sendDiscordAlert } from '../../lib/audit/discord'

const MEASUREMENT_WINDOW_DAYS = 7

// Map agent_type to the metric it most affects
const AGENT_METRIC_MAP: Record<string, string> = {
  output: 'output_quality_avg',
  acquisition: 'signup_conversion_rate',
  activation: 'activation_rate',
  retention: 'retention_7d',
  technical: 'render_failure_rate',
  cold_email: 'cold_email_reply_rate_14d',
}

export async function runOutcomeMeasurer() {
  console.log('[outcome-measurer] Starting...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Find findings fixed exactly MEASUREMENT_WINDOW_DAYS ago (within a 24h window)
  const targetDate = new Date(
    Date.now() - MEASUREMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
  const windowStart = new Date(targetDate)
  windowStart.setHours(0, 0, 0, 0)
  const windowEnd = new Date(targetDate)
  windowEnd.setHours(23, 59, 59, 999)

  const { data: fixedFindings } = await admin
    .from('audit_findings')
    .select(
      'id, agent_type, title, predicted_impact_bucket, predicted_impact_ux, predicted_confidence, predicted_effort_hours, auto_fix_pr_url, updated_at'
    )
    .eq('status', 'fixed')
    .gte('updated_at', windowStart.toISOString())
    .lte('updated_at', windowEnd.toISOString())

  if (!fixedFindings || fixedFindings.length === 0) {
    console.log(
      `[outcome-measurer] No findings fixed on ${targetDate.toISOString().slice(0, 10)}, skipping`
    )
    return
  }

  console.log(
    `[outcome-measurer] Found ${fixedFindings.length} findings fixed ${MEASUREMENT_WINDOW_DAYS} days ago`
  )

  let measured = 0
  let worked = 0

  for (const finding of fixedFindings) {
    try {
      const metricName = AGENT_METRIC_MAP[finding.agent_type]
      if (!metricName) {
        console.log(
          `[outcome-measurer] No metric mapped for agent_type=${finding.agent_type}, skipping ${finding.id}`
        )
        continue
      }

      const fixDate = new Date(finding.updated_at)

      // Get metric BEFORE fix (7 days before fix)
      const beforeDate = new Date(
        fixDate.getTime() - MEASUREMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10)
      const { data: metricBefore } = await admin
        .from('audit_metrics_snapshots')
        .select('metric_value')
        .eq('metric_name', metricName)
        .eq('snapshot_date', beforeDate)
        .maybeSingle()

      // Get metric AFTER fix (today, 7 days after fix)
      const afterDate = new Date().toISOString().slice(0, 10)
      const { data: metricAfter } = await admin
        .from('audit_metrics_snapshots')
        .select('metric_value')
        .eq('metric_name', metricName)
        .eq('snapshot_date', afterDate)
        .maybeSingle()

      if (!metricBefore?.metric_value && !metricAfter?.metric_value) {
        console.log(
          `[outcome-measurer] No metric data for ${metricName}, skipping ${finding.id}`
        )
        continue
      }

      const before = metricBefore?.metric_value ?? 0
      const after = metricAfter?.metric_value ?? 0
      const liftPercent =
        before !== 0 ? ((after - before) / Math.abs(before)) * 100 : 0

      // Determine if it worked
      // For metrics where lower is better (failure rate), invert the logic
      const lowerIsBetter = metricName.includes('failure') || metricName.includes('bounce')
      const effectiveLift = lowerIsBetter ? -liftPercent : liftPercent

      // Bucket-based expected lift thresholds
      const bucketThresholds: Record<string, number> = {
        critical: 10, high: 5, medium: 2, low: 0.5, unknown: 1,
      }
      const predictedImpact = bucketThresholds[finding.predicted_impact_bucket ?? 'unknown'] ?? 1

      // Confidence in attribution: lower if lift is small or too many variables
      let attributionConfidence = 5
      if (Math.abs(effectiveLift) < 1) attributionConfidence = 2
      if (Math.abs(effectiveLift) > 20) attributionConfidence = 7
      if (Math.abs(effectiveLift) > 50) attributionConfidence = 3 // suspiciously large = probably noise

      const didItWork =
        attributionConfidence < 3
          ? null // inconclusive
          : effectiveLift > 0 && effectiveLift >= predictedImpact * 0.5

      await admin.from('outcome_measurements').insert({
        finding_id: finding.id,
        fix_pr_url: finding.auto_fix_pr_url ?? '',
        fix_merged_at: fixDate.toISOString(),
        measurement_window_days: MEASUREMENT_WINDOW_DAYS,
        predicted_impact_bucket: finding.predicted_impact_bucket ?? 'unknown',
        predicted_impact_ux: finding.predicted_impact_ux,
        actual_metric_before: before,
        actual_metric_after: after,
        actual_lift_percent: liftPercent,
        did_it_work: didItWork,
        confidence_in_attribution: attributionConfidence,
        notes:
          attributionConfidence < 3
            ? 'Inconclusive — lift too large or too small to attribute'
            : null,
        measured_at: new Date().toISOString(),
      })

      measured++
      if (didItWork) worked++

      console.log(
        `[outcome-measurer] ${finding.title}: ${before} → ${after} (${liftPercent.toFixed(1)}%) → ${didItWork === null ? 'inconclusive' : didItWork ? 'worked' : 'did not work'}`
      )
    } catch (err) {
      console.error(
        `[outcome-measurer] Error measuring ${finding.id}:`,
        err
      )
    }
  }

  // Weekly summary (Sunday)
  if (new Date().getDay() === 0) {
    await postWeeklySummary(admin)
  }

  console.log(
    `[outcome-measurer] Done. ${measured} measured, ${worked} worked.`
  )
}

async function postWeeklySummary(admin: ReturnType<typeof createAdminClient>) {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outcomes } = await (admin as any)
    .from('outcome_measurements')
    .select('*')
    .gte('measured_at', thirtyDaysAgo)

  if (!outcomes || outcomes.length === 0) return

  const total = outcomes.length
  const workedCount = outcomes.filter(
    (o: { did_it_work: boolean | null }) => o.did_it_work === true
  ).length
  const failedCount = outcomes.filter(
    (o: { did_it_work: boolean | null }) => o.did_it_work === false
  ).length
  const inconclusive = total - workedCount - failedCount

  const successRate =
    workedCount + failedCount > 0
      ? ((workedCount / (workedCount + failedCount)) * 100).toFixed(0)
      : 'N/A'

  // Calibration: predicted vs actual
  const withPredictions = outcomes.filter(
    (o: {
      predicted_impact_conversion: number | null
      actual_lift_percent: number | null
    }) =>
      o.predicted_impact_conversion != null && o.actual_lift_percent != null
  )
  let calibrationMsg = ''
  if (withPredictions.length > 0) {
    const avgPredicted =
      withPredictions.reduce(
        (s: number, o: { predicted_impact_conversion: number }) =>
          s + o.predicted_impact_conversion,
        0
      ) / withPredictions.length
    const avgActual =
      withPredictions.reduce(
        (s: number, o: { actual_lift_percent: number }) =>
          s + o.actual_lift_percent,
        0
      ) / withPredictions.length
    const overEstimate =
      avgPredicted !== 0
        ? (((avgPredicted - avgActual) / avgPredicted) * 100).toFixed(0)
        : '0'
    calibrationMsg = `Calibration: predictions ${Number(overEstimate) > 0 ? 'overestimated' : 'underestimated'} by ${Math.abs(Number(overEstimate))}% on average`
  }

  const summary = `Outcome Report (30 days)
- ${total} measured
- ${workedCount} worked (${successRate}% success rate)
- ${failedCount} did not work
- ${inconclusive} inconclusive
${calibrationMsg ? `- ${calibrationMsg}` : ''}`

  console.log(`[outcome-measurer] Weekly summary:\n${summary}`)

  await sendDiscordAlert({
    severity: 'normal',
    agent_type: 'technical',
    title: 'Monthly Outcome Report',
    description: summary,
  })
}

if (typeof require !== 'undefined' && require.main === module) {
  import('dotenv').then((d) => d.config({ path: '.env.local' }))
  runOutcomeMeasurer()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[outcome-measurer] Fatal:', err)
      process.exit(1)
    })
}
