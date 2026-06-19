/**
 * Weekly Stats Digest — runs MONDAY 9am EST (via cron or manual)
 *
 * Aggregates business metrics and posts to #weekly-stats on Discord.
 *
 * Run: npx tsx scripts/business/weekly-stats-digest.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { postToDiscord } from '../../lib/discord/post'

export async function runWeeklyStatsDigest() {
  console.log('[weekly-stats] Generating digest...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Signups this week vs last week
  const { count: signupsThisWeek } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { count: signupsLastWeek } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo)

  // Paid users
  const { count: totalPaid } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('plan', ['pro', 'studio'])

  // Renders this week
  const { count: rendersThisWeek } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { count: rendersLastWeek } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo)

  // Render success rate
  const { count: renderSuccess } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)
    .eq('status', 'done')

  const successRate =
    (rendersThisWeek ?? 0) > 0
      ? (((renderSuccess ?? 0) / (rendersThisWeek ?? 1)) * 100).toFixed(0)
      : 'N/A'

  // Audit findings this week
  const { count: findingsThisWeek } = await admin
    .from('audit_findings')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { count: findingsFixed } = await admin
    .from('audit_findings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'fixed')
    .gte('updated_at', sevenDaysAgo)

  // Format deltas
  const delta = (thisWeek: number | null, lastWeek: number | null) => {
    const tw = thisWeek ?? 0
    const lw = lastWeek ?? 0
    if (lw === 0) return tw > 0 ? `+${tw}` : '0'
    const pct = ((tw - lw) / lw) * 100
    return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`
  }

  const weekStr = now.toISOString().slice(0, 10)

  await postToDiscord({
    channel: 'weekly-stats',
    embed: {
      title: `Weekly Stats — w/e ${weekStr}`,
      color: 0x5865f2,
      fields: [
        {
          name: 'Signups',
          value: `${signupsThisWeek ?? 0} (${delta(signupsThisWeek, signupsLastWeek)} vs last week)`,
          inline: true,
        },
        {
          name: 'Paid users',
          value: `${totalPaid ?? 0} total`,
          inline: true,
        },
        {
          name: 'Renders',
          value: `${rendersThisWeek ?? 0} (${delta(rendersThisWeek, rendersLastWeek)}) | ${successRate}% success`,
          inline: false,
        },
        {
          name: 'Audit',
          value: `${findingsThisWeek ?? 0} new findings | ${findingsFixed ?? 0} fixed`,
          inline: false,
        },
      ],
    },
  })

  console.log('[weekly-stats] Digest posted to Discord.')
}

if (typeof require !== 'undefined' && require.main === module) {
  import('dotenv').then((d) => d.config({ path: '.env.local' }))
  runWeeklyStatsDigest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[weekly-stats] Fatal:', err)
      process.exit(1)
    })
}
