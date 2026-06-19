/**
 * Lab Discord Daily Digest
 *
 * Posts summary of completed deep dives to Discord.
 * Run: npx tsx scripts/lab/discord-digest.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createAdminClient } from '../../lib/supabase/admin'

const DISCORD_WEBHOOK = process.env.DISCORD_LAB_WEBHOOK_URL

async function postDailyLabDigest() {
  if (!DISCORD_WEBHOOK) {
    console.log('[lab:digest] DISCORD_LAB_WEBHOOK_URL not set, skipping')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Recent completed dives
  const { data: completed } = await admin
    .from('lab_deep_dives')
    .select('id, feature_area, cycle_number, final_recommendation, confidence, estimated_effort_hours, kill_switch_severity')
    .eq('status', 'completed')
    .gte('deliverable_completed_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(5)

  // Currently running
  const { data: running } = await admin
    .from('lab_deep_dives')
    .select('id, feature_area, intuition_completed_at, context_completed_at, research_completed_at, metric_completed_at, council_completed_at, synthesis_completed_at')
    .eq('status', 'running')
    .limit(1)
    .maybeSingle()

  // Next in queue
  const { data: nextQueue } = await admin
    .from('lab_queue')
    .select('feature_area, next_scheduled_at, priority')
    .eq('active', true)
    .order('forced_next', { ascending: false })
    .order('priority', { ascending: false })
    .order('next_scheduled_at', { ascending: true })
    .limit(3)

  const completedList = completed ?? []
  if (completedList.length === 0 && !running) {
    console.log('[lab:digest] Nothing to report')
    return
  }

  // Build embed fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: any[] = []

  for (const d of completedList.slice(0, 3)) {
    const recommendation = (d.final_recommendation ?? '').slice(0, 200)
    const killBadge = d.kill_switch_severity >= 7 ? ' **[HIGH RISK]**' : ''
    fields.push({
      name: `Done: ${d.feature_area} (#${d.cycle_number})${killBadge}`,
      value: `${recommendation}...\nConfidence: ${d.confidence}/10 | Effort: ${d.estimated_effort_hours}h`,
      inline: false,
    })
  }

  if (running) {
    const phase = getCurrentPhase(running)
    fields.push({
      name: `Running: ${running.feature_area}`,
      value: `Phase ${phase}/7`,
      inline: false,
    })
  }

  if (nextQueue && nextQueue.length > 0) {
    fields.push({
      name: 'Next in queue',
      value: nextQueue.map((q: { feature_area: string; next_scheduled_at: string }) =>
        `${q.feature_area} (${formatRelative(q.next_scheduled_at)})`
      ).join(' | '),
      inline: false,
    })
  }

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: 'Lab Daily Digest',
        description: `${completedList.length} deep dive(s) ready${running ? ' | 1 running' : ''}`,
        fields,
        color: 0x00E1FF,
        footer: { text: 'The Lab — Product Decision Intelligence' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })

  console.log('[lab:digest] Posted to Discord')
}

function getCurrentPhase(dive: Record<string, string | null>): number {
  if (dive.synthesis_completed_at) return 7
  if (dive.council_completed_at) return 6
  if (dive.metric_completed_at) return 5
  if (dive.research_completed_at) return 4
  if (dive.context_completed_at) return 3
  if (dive.intuition_completed_at) return 2
  return 1
}

function formatRelative(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  const hours = Math.round(diff / (1000 * 60 * 60))
  if (hours < 0) return 'now'
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

postDailyLabDigest().catch(console.error)
