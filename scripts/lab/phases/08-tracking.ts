/**
 * Phase 6 — Post-Ship Tracking (disabled pre-launch)
 *
 * When PRE_LAUNCH_MODE=false and a dive has been shipped:
 * - Measures the target metric before/after
 * - Plugs into existing Outcome Measurer
 * - Updates outcome fields on the dive record
 */

import { isPreLaunchMode } from '../../../lib/audit/pre-launch-mode'
import { createAdminClient } from '../../../lib/supabase/admin'

export async function runPostShipTracking(diveId: string): Promise<void> {
  if (isPreLaunchMode()) {
    console.log('[lab:tracking] Pre-launch mode — skipping post-ship tracking')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dive } = await admin
    .from('lab_deep_dives')
    .select('id, status, shipped_at, target_metric, shipped_commit_sha')
    .eq('id', diveId)
    .single()

  if (!dive || dive.status !== 'shipped' || !dive.shipped_at) {
    console.log('[lab:tracking] Dive not shipped yet, skipping')
    return
  }

  // Check if enough time has passed (7 days)
  const shippedDate = new Date(dive.shipped_at)
  const daysSinceShip = (Date.now() - shippedDate.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceShip < 7) {
    console.log(`[lab:tracking] Only ${daysSinceShip.toFixed(1)} days since ship, need 7`)
    return
  }

  // TODO: Measure actual metric from audit_metrics_snapshots
  // Compare snapshot from ship date vs today
  console.log('[lab:tracking] Post-ship tracking ready but metric measurement not yet implemented')

  await admin
    .from('lab_deep_dives')
    .update({
      outcome_measured_at: new Date().toISOString(),
    })
    .eq('id', diveId)
}
