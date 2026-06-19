/**
 * Lab Queue Manager
 *
 * Picks next feature for deep dive based on:
 * - forced_next DESC (manual jump)
 * - priority DESC (higher = sooner)
 * - last_dived_at ASC (least recently dived first)
 */

import { createAdminClient } from '../../lib/supabase/admin'
import type { QueueEntry, FeatureConfig, LabConfig } from '../../lib/lab/types'
import featuresConfig from '../../lib/lab/features-config.json'

const config = featuresConfig as LabConfig

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function admin(): any {
  return createAdminClient() as any
}

export async function pickNextFeature(): Promise<{ area: string; cycle: number; config: FeatureConfig } | null> {
  const { data } = await admin()
    .from('lab_queue')
    .select('*')
    .eq('active', true)
    .lte('next_scheduled_at', new Date().toISOString())
    .order('forced_next', { ascending: false })
    .order('priority', { ascending: false })
    .order('last_dived_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const entry = data as QueueEntry
  const featureConfig = config.features.find(f => f.area === entry.feature_area)
  if (!featureConfig) return null

  return {
    area: entry.feature_area,
    cycle: entry.current_cycle,
    config: featureConfig,
  }
}

export async function getFeatureByArea(area: string): Promise<{ area: string; cycle: number; config: FeatureConfig } | null> {
  const { data } = await admin()
    .from('lab_queue')
    .select('*')
    .eq('feature_area', area)
    .maybeSingle()

  const featureConfig = config.features.find(f => f.area === area)
  if (!featureConfig) return null

  const entry = data as QueueEntry | null
  return {
    area,
    cycle: entry?.current_cycle ?? 1,
    config: featureConfig,
  }
}

export async function createDeepDiveRecord(feature: { area: string; cycle: number }) {
  const { data } = await admin()
    .from('lab_deep_dives')
    .insert({
      feature_area: feature.area,
      cycle_number: feature.cycle,
      status: 'running',
      target_metric: '',
    })
    .select('id, feature_area, cycle_number, status, created_at')
    .single()

  return data as { id: string; feature_area: string; cycle_number: number; status: string; created_at: string }
}

export async function updateDive(diveId: string, updates: Record<string, unknown>) {
  await admin()
    .from('lab_deep_dives')
    .update(updates)
    .eq('id', diveId)
}

export async function markDiveStatus(diveId: string, status: string, errorMessage?: string) {
  const updates: Record<string, unknown> = { status }
  if (errorMessage) {
    updates.final_recommendation = `FAILED: ${errorMessage}`
  }
  await updateDive(diveId, updates)
}

export async function markComplete(diveId: string) {
  await updateDive(diveId, { status: 'completed' })
}

export async function updateQueue(area: string) {
  const nextScheduled = new Date(Date.now() + config.frequency_hours * 3600 * 1000)

  // Get current cycle info
  const { data: current } = await admin()
    .from('lab_queue')
    .select('current_cycle')
    .eq('feature_area', area)
    .single()

  // Check if all features have been dived this cycle
  const { data: allQueues } = await admin()
    .from('lab_queue')
    .select('feature_area, last_dived_at, current_cycle')
    .eq('active', true)

  const allDived = (allQueues ?? []).every(
    (q: { last_dived_at: string | null }) => q.last_dived_at !== null
  )

  const newCycle = allDived ? (current?.current_cycle ?? 1) + 1 : current?.current_cycle ?? 1

  await admin()
    .from('lab_queue')
    .update({
      last_dived_at: new Date().toISOString(),
      next_scheduled_at: nextScheduled.toISOString(),
      forced_next: false,
      current_cycle: newCycle,
    })
    .eq('feature_area', area)
}

export async function checkMonthlyCostCap(): Promise<{ exceeded: boolean; total: number }> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data } = await admin()
    .from('lab_deep_dives')
    .select('total_cost_usd')
    .gte('created_at', startOfMonth.toISOString())
    .not('total_cost_usd', 'is', null)

  const total = (data ?? []).reduce(
    (sum: number, d: { total_cost_usd: number }) => sum + (d.total_cost_usd ?? 0),
    0
  )

  return {
    exceeded: total >= config.monthly_cost_cap_usd,
    total,
  }
}
