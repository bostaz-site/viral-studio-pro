/**
 * Lab Discord — Cycle Complete Notification
 *
 * V3: 1 ping per cycle (not daily digest). Called at end of --chain run.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createAdminClient } from '../../lib/supabase/admin'

const DISCORD_WEBHOOK = process.env.DISCORD_LAB_WEBHOOK_URL

function getKillSwitchEmoji(severity: number | null): string {
  if (!severity) return '?'
  if (severity >= 8) return '!!!'
  if (severity >= 5) return '!'
  return 'ok'
}

export async function postCycleCompleteNotification(diveIds: string[]) {
  if (!DISCORD_WEBHOOK) {
    console.log('[lab:discord] DISCORD_LAB_WEBHOOK_URL not set, skipping')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dives } = await admin
    .from('lab_deep_dives')
    .select('id, feature_area, cycle_number, final_recommendation, confidence, estimated_effort_hours, kill_switch_severity, total_cost_usd, status')
    .in('id', diveIds)
    .order('created_at', { ascending: true })

  const completed = (dives ?? []).filter((d: { status: string }) => d.status === 'completed')
  if (completed.length === 0) {
    console.log('[lab:discord] No completed dives to report')
    return
  }

  const totalCost = (dives ?? []).reduce((s: number, d: { total_cost_usd: number | null }) => s + (d.total_cost_usd ?? 0), 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = completed.slice(0, 10).map((d: any) => {
    const killBadge = (d.kill_switch_severity ?? 0) >= 7 ? ' [HIGH RISK]' : ''
    const recommendation = (d.final_recommendation ?? '').slice(0, 150)
    return {
      name: `[${getKillSwitchEmoji(d.kill_switch_severity)}] ${d.feature_area} (#${d.cycle_number})${killBadge}`,
      value: `${recommendation}...\nConfidence: ${d.confidence}/10 | Effort: ${d.estimated_effort_hours}h`,
      inline: false,
    }
  })

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `Lab Cycle Complete — ${completed.length}/${dives?.length ?? 0} dives ready`,
        description: `Total cost: $${totalCost.toFixed(2)} | Check /admin/lab for full details`,
        fields,
        color: 0x00E1FF,
        footer: { text: 'The Lab V3 — Product Decision Intelligence' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })

  console.log(`[lab:discord] Posted cycle complete notification (${completed.length} dives)`)
}

// CLI: can also run standalone for testing
if (require.main === module) {
  const testIds = process.argv.slice(2)
  if (testIds.length === 0) {
    console.log('Usage: npx tsx scripts/lab/discord-digest.ts <diveId1> <diveId2> ...')
    process.exit(0)
  }
  postCycleCompleteNotification(testIds).catch(console.error)
}
