/**
 * Retention Agent
 *
 * Audits return users, distribution flow, and publishing behavior.
 * Persona: Growth engineer at Buffer who built retention loops
 * for prosumers.
 *
 * Run: npx tsx scripts/audits/retention.ts
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { runAgent } from '@/lib/audit/agent-runner'
import { insertMetricSnapshot } from '@/lib/audit/insert-metric'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

function readProjectFile(relativePath: string): string | null {
  const fullPath = join(ROOT, relativePath)
  if (!existsSync(fullPath)) return null
  try {
    return readFileSync(fullPath, 'utf8').slice(0, 4000)
  } catch {
    return null
  }
}

export async function runRetentionAudit() {
  console.log('[retention] Starting audit...')
  const admin = createAdminClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Active users (users who rendered a clip in last 7 days)
  const { data: recentRenders } = await admin
    .from('render_jobs')
    .select('user_id')
    .eq('status', 'done')
    .gte('created_at', sevenDaysAgo)

  const activeUserIds = [...new Set(recentRenders?.map(r => r.user_id).filter(Boolean) ?? [])]

  // 2. Return users (active this week AND had a clip before this week)
  let returnUserCount = 0
  if (activeUserIds.length > 0) {
    const { count } = await admin
      .from('render_jobs')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', activeUserIds as string[])
      .eq('status', 'done')
      .lt('created_at', sevenDaysAgo)

    returnUserCount = count ?? 0
  }

  const returnUserRate = activeUserIds.length > 0
    ? (returnUserCount / activeUserIds.length) * 100
    : 0

  // 3. Clips per active user
  const clipsPerUser = activeUserIds.length > 0
    ? (recentRenders?.length ?? 0) / activeUserIds.length
    : 0

  // 4. Published posts stats
  const { data: publishedPosts } = await admin
    .from('published_posts')
    .select('id, platform, clip_id')
    .gte('published_at', sevenDaysAgo)

  const { count: totalRendered7d } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'done')
    .gte('created_at', sevenDaysAgo)

  const publishCount = publishedPosts?.length ?? 0
  const renderedCount = totalRendered7d ?? 1
  const publishRate = renderedCount > 0 ? (publishCount / renderedCount) * 100 : 0

  // Platform breakdown
  const platformCounts: Record<string, number> = {}
  for (const post of publishedPosts ?? []) {
    platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1
  }

  // 5. 30-day user cohort analysis (simplified)
  const { data: monthUsers } = await admin
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', thirtyDaysAgo)
    .lte('created_at', sevenDaysAgo)

  let monthRetention = 0
  if (monthUsers && monthUsers.length > 0) {
    const { count: retained } = await admin
      .from('render_jobs')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', monthUsers.map(u => u.id))
      .eq('status', 'done')
      .gte('created_at', sevenDaysAgo)

    monthRetention = monthUsers.length > 0 ? ((retained ?? 0) / monthUsers.length) * 100 : 0
  }

  // 6. Read distribution flow code
  const distributionCode: Record<string, string | null> = {
    'distribution/page': readProjectFile('app/(dashboard)/dashboard/distribution/page.tsx'),
    'publish-dialog': readProjectFile('components/publish/unified-publish-dialog.tsx'),
  }

  // 7. Run agent
  const result = await runAgent({
    agent_type: 'retention',
    persona_prompt: 'a growth engineer at Buffer who built retention loops for prosumers. You understand that retention is driven by habit formation, value delivery speed, and reducing friction in repeat usage. You think in terms of activation loops and re-engagement triggers.',
    inputs: {
      stats: {
        active_users_7d: activeUserIds.length,
        return_user_count: returnUserCount,
        return_user_rate_7d: Math.round(returnUserRate * 10) / 10,
        clips_per_active_user_avg: Math.round(clipsPerUser * 100) / 100,
        publish_rate_per_clip: Math.round(publishRate * 10) / 10,
        published_posts_7d: publishCount,
        rendered_clips_7d: renderedCount,
        platform_breakdown: platformCounts,
        month_cohort_retention: Math.round(monthRetention * 10) / 10,
        month_cohort_size: monthUsers?.length ?? 0,
      },
      distribution_code: distributionCode,
    },
  })

  // 8. Record metrics
  await insertMetricSnapshot({
    metric_name: 'return_user_rate_7d',
    metric_value: Math.round(returnUserRate * 10) / 10,
    metric_unit: 'percentage',
    regression_threshold_percent: 15,
  })
  await insertMetricSnapshot({
    metric_name: 'clips_per_active_user_avg',
    metric_value: Math.round(clipsPerUser * 100) / 100,
    metric_unit: 'count',
  })
  await insertMetricSnapshot({
    metric_name: 'publish_rate_per_clip',
    metric_value: Math.round(publishRate * 10) / 10,
    metric_unit: 'percentage',
  })

  console.log(`[retention] Done. ${result.findings.length} findings. Return rate: ${returnUserRate.toFixed(1)}%, Publish rate: ${publishRate.toFixed(1)}%`)
}

// Allow standalone execution
if (require.main === module) {
  runRetentionAudit()
    .then(() => { console.log('[retention] Complete.'); process.exit(0) })
    .catch((err) => { console.error('[retention] Fatal:', err); process.exit(1) })
}
