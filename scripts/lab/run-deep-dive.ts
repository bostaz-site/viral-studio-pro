/**
 * The Lab V3 — Deep Dive Pipeline
 *
 * Usage:
 *   - Single:  npx tsx scripts/lab/run-deep-dive.ts --area=enhance-render
 *   - Chain:   npx tsx scripts/lab/run-deep-dive.ts --chain  (all 9 features)
 *   - Auto:    npx tsx scripts/lab/run-deep-dive.ts           (pick next from queue)
 *
 * V3 changes: manual trigger only, file-based output, Sonnet+Opus+Gemini council
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
  getAllActiveFeatures,
  createDeepDiveRecord,
  markDiveStatus,
  updateQueue,
  checkMonthlyCostCap,
  updateDive,
} from './queue'
import { postCycleCompleteNotification } from './discord-digest'
import { isPreLaunchMode } from '../../lib/audit/pre-launch-mode'
import featuresConfig from '../../lib/lab/features-config.json'
import type { LabConfig } from '../../lib/lab/types'

const labConfig = featuresConfig as LabConfig

async function runSingleDive(forceArea?: string): Promise<string | null> {
  // Cost cap check
  const costCheck = await checkMonthlyCostCap()
  if (costCheck.exceeded) {
    console.error(`[lab] Monthly cost cap exceeded ($${costCheck.total.toFixed(2)} / $${labConfig.monthly_cost_cap_usd}). Skipping.`)
    return null
  }

  const feature = forceArea
    ? await getFeatureByArea(forceArea)
    : await pickNextFeature()

  if (!feature) {
    console.log('[lab] No feature ready in queue. Exiting.')
    return null
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[lab] Feature: ${feature.config.name} (${feature.area}, cycle #${feature.cycle})`)
  console.log('='.repeat(60))

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

    // Fetch accumulated dive state
    const { createAdminClient } = await import('../../lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const { data: diveState } = await admin
      .from('lab_deep_dives')
      .select('context_founder_goals, context_main_doc, research_synthesis, intuition_solution, target_metric, target_delta_minimum')
      .eq('id', dive.id)
      .single()

    // Phase 2 — Deep Research
    console.log('\n--- Phase 2: Deep Research ---')
    const p2 = await runDeepResearch(dive.id, feature.config, diveState?.context_founder_goals ?? '')
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
      dive.id, feature.area,
      diveState2?.context_founder_goals ?? '',
      diveState2?.research_synthesis ?? ''
    )
    totalCost += p3.cost

    if (p3.clarity < labConfig.min_metric_clarity) {
      console.warn(`[lab] STOP — Metric clarity too low (${p3.clarity}/10). Aborting dive.`)
      await markDiveStatus(dive.id, 'failed', `Metric clarity too low: ${p3.clarity}/10`)
      await updateDive(dive.id, { total_cost_usd: totalCost, total_duration_seconds: Math.round((Date.now() - startTime) / 1000) })
      return null
    }

    // Refetch for council
    const { data: diveState3 } = await admin
      .from('lab_deep_dives')
      .select('context_founder_goals, context_main_doc, research_synthesis, target_metric, target_delta_minimum, intuition_solution')
      .eq('id', dive.id)
      .single()

    // Phase 3 — Multi-LLM Council
    console.log('\n--- Phase 3: Multi-LLM Council ---')
    const p4 = await runMultiLlmCouncil(dive.id, {
      feature_area: feature.area,
      context_founder_goals: diveState3?.context_founder_goals ?? null,
      context_main_doc: diveState3?.context_main_doc ?? null,
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
      await runPostShipTracking(dive.id)
    }

    // Finalize
    await updateDive(dive.id, {
      total_cost_usd: totalCost,
      total_duration_seconds: Math.round((Date.now() - startTime) / 1000),
    })
    await updateQueue(feature.area)

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log(`\n[lab] Deep dive COMPLETE: ${feature.area} (${elapsed}min, $${totalCost.toFixed(4)})`)
    return dive.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[lab] Deep dive FAILED:`, err)
    await markDiveStatus(dive.id, 'failed', message)
    await updateDive(dive.id, { total_cost_usd: totalCost, total_duration_seconds: Math.round((Date.now() - startTime) / 1000) })
    return null
  }
}

async function runFullCycleChained() {
  const features = await getAllActiveFeatures()
  console.log('='.repeat(60))
  console.log(`[${new Date().toISOString()}] The Lab V3 — CHAIN MODE`)
  console.log(`  ${features.length} features to process`)
  console.log(`  Pre-launch mode: ${isPreLaunchMode() ? 'YES' : 'NO'}`)
  console.log('='.repeat(60))

  const results: Array<{ area: string; diveId: string | null; status: 'ok' | 'failed' | 'skipped' }> = []
  const startTime = Date.now()

  for (let i = 0; i < features.length; i++) {
    const feature = features[i]
    console.log(`\n[lab] [${i + 1}/${features.length}] ${feature.area}`)

    try {
      const diveId = await runSingleDive(feature.area)
      results.push({ area: feature.area, diveId, status: diveId ? 'ok' : 'skipped' })
    } catch (err) {
      console.error(`[lab] Failed on ${feature.area}:`, err)
      results.push({ area: feature.area, diveId: null, status: 'failed' })
    }

    // Pause between dives (rate limits, KG digestion)
    if (i < features.length - 1) {
      const pauseMin = 2
      console.log(`[lab] Pause ${pauseMin} min before next dive...`)
      await new Promise(resolve => setTimeout(resolve, pauseMin * 60 * 1000))
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  const succeeded = results.filter(r => r.status === 'ok').length
  const failed = results.filter(r => r.status === 'failed').length

  console.log('\n' + '='.repeat(60))
  console.log(`[lab] CYCLE COMPLETE in ${elapsed} min`)
  console.log(`  ${succeeded} succeeded, ${failed} failed, ${results.length - succeeded - failed} skipped`)
  console.log('='.repeat(60))

  // Post Discord notification for completed cycle
  const completedIds = results.filter(r => r.diveId).map(r => r.diveId!)
  if (completedIds.length > 0) {
    await postCycleCompleteNotification(completedIds).catch(err => {
      console.error('[lab] Discord notification failed:', err)
    })
  }
}

// CLI entry point
const args = process.argv.slice(2)

if (args.includes('--chain')) {
  runFullCycleChained().catch(err => {
    console.error('[lab] Fatal error:', err)
    process.exit(1)
  })
} else {
  const forceArg = args.find(a => a.startsWith('--area='))
  const forceArea = forceArg?.split('=')[1]

  console.log('='.repeat(60))
  console.log(`[${new Date().toISOString()}] The Lab V3 — Deep Dive`)
  console.log(`  Pre-launch mode: ${isPreLaunchMode() ? 'YES' : 'NO'}`)
  console.log('='.repeat(60))

  runSingleDive(forceArea).catch(err => {
    console.error('[lab] Fatal error:', err)
    process.exit(1)
  })
}
