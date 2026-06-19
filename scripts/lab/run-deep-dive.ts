/**
 * The Lab — Deep Dive Pipeline (7 phases)
 *
 * Usage:
 *   - Automatic: Railway cron every 48h → pick next from queue
 *   - Manual:    npx tsx scripts/lab/run-deep-dive.ts --area=enhance
 *
 * Phases:
 *   0. Intuition Snap (~2 min)
 *   1. Context Gathering (~5 min)
 *   2. Deep Research (~10 min)
 *   2.5. Metric Framing — STOP gate (~3 min)
 *   3. Multi-LLM Council (~10 min)
 *   4. Synthesis + Kill Switch (~5 min)
 *   5. Deliverable generation (~2 min)
 *   6. Post-Ship Tracking (disabled pre-launch)
 *
 * Total: ~30-40 min, ~$5 per dive
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { runIntuitionSnap } from './phases/01-intuition'
import { runContextGathering } from './phases/02-context'
import { runDeepResearch } from './phases/03-research'
import { runMetricFraming } from './phases/04-metric'
import { runMultiLlmCouncil } from './phases/05-council'
import { runSynthesisAndKillSwitch } from './phases/06-synthesis'
import { generateDeliverable } from './phases/07-deliverable'
import { runPostShipTracking } from './phases/08-tracking'
import {
  pickNextFeature,
  getFeatureByArea,
  createDeepDiveRecord,
  markDiveStatus,
  updateQueue,
  checkMonthlyCostCap,
  updateDive,
} from './queue'
import { isPreLaunchMode } from '../../lib/audit/pre-launch-mode'
import featuresConfig from '../../lib/lab/features-config.json'
import type { LabConfig } from '../../lib/lab/types'

const labConfig = featuresConfig as LabConfig

async function runDeepDive(forceArea?: string) {
  console.log('='.repeat(60))
  console.log(`[${new Date().toISOString()}] The Lab — Deep Dive START`)
  console.log(`  Pre-launch mode: ${isPreLaunchMode() ? 'YES' : 'NO'}`)
  console.log('='.repeat(60))

  // Cost cap check
  const costCheck = await checkMonthlyCostCap()
  if (costCheck.exceeded) {
    console.error(`[lab] Monthly cost cap exceeded ($${costCheck.total.toFixed(2)} / $${labConfig.monthly_cost_cap_usd}). Skipping.`)
    return
  }

  // Pick feature
  const feature = forceArea
    ? await getFeatureByArea(forceArea)
    : await pickNextFeature()

  if (!feature) {
    console.log('[lab] No feature ready in queue. Exiting.')
    return
  }

  console.log(`[lab] Feature: ${feature.config.name} (${feature.area}, cycle #${feature.cycle})`)

  const startTime = Date.now()
  let totalCost = 0
  const dive = await createDeepDiveRecord(feature)

  try {
    // Phase 0 — Intuition Snap
    console.log('\n--- Phase 0: Intuition Snap ---')
    const p0 = await runIntuitionSnap(dive.id, feature.area, feature.config.name)
    totalCost += p0.cost

    // Phase 1 — Context Gathering
    console.log('\n--- Phase 1: Context Gathering ---')
    const p1 = await runContextGathering(dive.id, feature.config)
    totalCost += p1.cost

    // Fetch accumulated dive state for next phases
    const { createAdminClient } = await import('../../lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const { data: diveState } = await admin
      .from('lab_deep_dives')
      .select('context_founder_goals, research_synthesis, intuition_solution, target_metric, target_delta_minimum')
      .eq('id', dive.id)
      .single()

    // Phase 2 — Deep Research
    console.log('\n--- Phase 2: Deep Research ---')
    const p2 = await runDeepResearch(
      dive.id,
      feature.config,
      diveState?.context_founder_goals ?? ''
    )
    totalCost += p2.cost

    // Refetch after research
    const { data: diveState2 } = await admin
      .from('lab_deep_dives')
      .select('context_founder_goals, research_synthesis')
      .eq('id', dive.id)
      .single()

    // Phase 2.5 — Metric Framing (STOP gate)
    console.log('\n--- Phase 2.5: Metric Framing ---')
    const p3 = await runMetricFraming(
      dive.id,
      feature.area,
      diveState2?.context_founder_goals ?? '',
      diveState2?.research_synthesis ?? ''
    )
    totalCost += p3.cost

    if (p3.clarity < labConfig.min_metric_clarity) {
      console.warn(`[lab] STOP — Metric clarity too low (${p3.clarity}/10 < ${labConfig.min_metric_clarity}). Aborting dive.`)
      await markDiveStatus(dive.id, 'failed', `Metric clarity too low: ${p3.clarity}/10`)
      await updateDive(dive.id, {
        total_cost_usd: totalCost,
        total_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      })
      return
    }

    // Refetch for council
    const { data: diveState3 } = await admin
      .from('lab_deep_dives')
      .select('context_founder_goals, research_synthesis, target_metric, target_delta_minimum, intuition_solution')
      .eq('id', dive.id)
      .single()

    // Phase 3 — Multi-LLM Council
    console.log('\n--- Phase 3: Multi-LLM Council ---')
    const p4 = await runMultiLlmCouncil(dive.id, {
      feature_area: feature.area,
      context_founder_goals: diveState3?.context_founder_goals ?? null,
      research_synthesis: diveState3?.research_synthesis ?? null,
      target_metric: diveState3?.target_metric ?? '',
      target_delta_minimum: diveState3?.target_delta_minimum ?? null,
    })
    totalCost += p4.cost

    // Phase 4 — Synthesis + Kill Switch
    console.log('\n--- Phase 4: Synthesis + Kill Switch ---')
    const p5 = await runSynthesisAndKillSwitch(
      dive.id,
      diveState3?.intuition_solution ?? null,
      diveState3?.target_metric ?? ''
    )
    totalCost += p5.cost

    // Phase 5 — Deliverable
    console.log('\n--- Phase 5: Deliverable ---')
    const p6 = await generateDeliverable(dive.id)
    totalCost += p6.cost

    // Phase 6 — Post-Ship Tracking (disabled pre-launch)
    if (!isPreLaunchMode()) {
      console.log('\n--- Phase 6: Post-Ship Tracking ---')
      await runPostShipTracking(dive.id)
    }

    // Finalize
    await updateDive(dive.id, {
      total_cost_usd: totalCost,
      total_duration_seconds: Math.round((Date.now() - startTime) / 1000),
    })
    await updateQueue(feature.area)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n' + '='.repeat(60))
    console.log(`[lab] Deep dive COMPLETE: ${feature.area}`)
    console.log(`  Duration: ${elapsed}s`)
    console.log(`  Total cost: $${totalCost.toFixed(4)}`)
    console.log(`  Monthly total: $${(costCheck.total + totalCost).toFixed(2)} / $${labConfig.monthly_cost_cap_usd}`)
    console.log('='.repeat(60))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[lab] Deep dive FAILED:`, err)
    await markDiveStatus(dive.id, 'failed', message)
    await updateDive(dive.id, {
      total_cost_usd: totalCost,
      total_duration_seconds: Math.round((Date.now() - startTime) / 1000),
    })
  }
}

// CLI entry point
const args = process.argv.slice(2)
const forceArg = args.find(a => a.startsWith('--area='))
const forceArea = forceArg?.split('=')[1]
runDeepDive(forceArea).catch((err) => {
  console.error('[lab] Fatal error:', err)
  process.exit(1)
})
