/**
 * Activation Agent
 *
 * Audits upload -> editor -> render -> success flow.
 * Persona: Lead UX engineer at Linear who obsesses over
 * first-use experience.
 *
 * Run: npx tsx scripts/audits/activation.ts
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

export async function runActivationAudit() {
  console.log('[activation] Starting audit...')
  const admin = createAdminClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Render jobs stats (last 7 days)
  const { data: renderJobs } = await admin
    .from('render_jobs')
    .select('id, status, error_message, created_at, updated_at')
    .gte('created_at', sevenDaysAgo)

  const totalRenders = renderJobs?.length ?? 0
  const doneRenders = renderJobs?.filter(j => j.status === 'done').length ?? 0
  const errorRenders = renderJobs?.filter(j => j.status === 'error').length ?? 0
  const renderSuccessRate = totalRenders > 0 ? (doneRenders / totalRenders) * 100 : 100

  // Collect error messages for analysis
  const errorMessages = renderJobs
    ?.filter(j => j.status === 'error' && j.error_message)
    .map(j => j.error_message!)
    .slice(0, 10) ?? []

  // Deduplicate error messages for pattern detection
  const errorCounts: Record<string, number> = {}
  for (const msg of errorMessages) {
    const key = msg.slice(0, 100)
    errorCounts[key] = (errorCounts[key] || 0) + 1
  }

  // 2. Upload stats (videos created last 7 days)
  const { data: uploads } = await admin
    .from('videos')
    .select('id, status, created_at')
    .gte('created_at', sevenDaysAgo)

  const totalUploads = uploads?.length ?? 0
  const doneUploads = uploads?.filter(v => v.status === 'done').length ?? 0
  const errorUploads = uploads?.filter(v => v.status === 'error').length ?? 0
  const uploadSuccessRate = totalUploads > 0
    ? ((totalUploads - errorUploads) / totalUploads) * 100
    : 100

  // 3. Time-to-first-clip estimation
  // Users who signed up in last 7 days and already have a rendered clip
  const { data: newUsers } = await admin
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', sevenDaysAgo)

  let usersWithClip = 0
  if (newUsers && newUsers.length > 0) {
    const { count } = await admin
      .from('render_jobs')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', newUsers.map(u => u.id))
      .eq('status', 'done')

    usersWithClip = count ?? 0
  }
  const activationRate = (newUsers?.length ?? 0) > 0
    ? (usersWithClip / newUsers!.length) * 100
    : 0

  // 4. Read activation flow code
  const flowCode: Record<string, string | null> = {
    'upload/page': readProjectFile('app/upload/page.tsx'),
    'upload/client': readProjectFile('app/upload/upload-client.tsx'),
    'enhance/page': readProjectFile('app/(dashboard)/dashboard/enhance/page.tsx'),
    'api/upload/sign': readProjectFile('app/api/upload/sign/route.ts'),
    'api/render': readProjectFile('app/api/render/route.ts'),
  }

  // 5. Run agent
  const result = await runAgent({
    agent_type: 'activation',
    persona_prompt: 'a lead UX engineer at Linear who obsesses over first-use experience. You believe the first 60 seconds of any product determine if a user stays or churns. You prioritize friction reduction and clear progress indicators.',
    inputs: {
      stats: {
        render_success_rate_7d: Math.round(renderSuccessRate * 10) / 10,
        upload_success_rate_7d: Math.round(uploadSuccessRate * 10) / 10,
        total_renders_7d: totalRenders,
        done_renders: doneRenders,
        error_renders: errorRenders,
        total_uploads_7d: totalUploads,
        activation_rate_new_users: Math.round(activationRate * 10) / 10,
        new_users_7d: newUsers?.length ?? 0,
        new_users_with_clip: usersWithClip,
      },
      error_patterns: errorCounts,
      flow_code: flowCode,
    },
  })

  // 6. Record metrics
  await insertMetricSnapshot({
    metric_name: 'upload_success_rate_7d',
    metric_value: Math.round(uploadSuccessRate * 10) / 10,
    metric_unit: 'percentage',
    regression_threshold_percent: 10,
  })
  await insertMetricSnapshot({
    metric_name: 'render_success_rate_7d',
    metric_value: Math.round(renderSuccessRate * 10) / 10,
    metric_unit: 'percentage',
    regression_threshold_percent: 10,
  })
  await insertMetricSnapshot({
    metric_name: 'activation_rate_new_users',
    metric_value: Math.round(activationRate * 10) / 10,
    metric_unit: 'percentage',
    regression_threshold_percent: 15,
  })

  console.log(`[activation] Done. ${result.findings.length} findings. Render success: ${renderSuccessRate.toFixed(1)}%, Upload success: ${uploadSuccessRate.toFixed(1)}%`)
}

// Allow standalone execution
if (require.main === module) {
  runActivationAudit()
    .then(() => { console.log('[activation] Complete.'); process.exit(0) })
    .catch((err) => { console.error('[activation] Fatal:', err); process.exit(1) })
}
