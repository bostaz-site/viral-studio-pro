/**
 * Technical Agent
 *
 * Audits code quality, performance, security, and infrastructure health.
 * Persona: Staff engineer at Stripe who reviews PRs for security,
 * perf, and maintainability.
 *
 * Run: npx tsx scripts/audits/technical.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { runAgent } from '../../lib/audit/agent-runner'
import { insertMetricSnapshot } from '../../lib/audit/insert-metric'
import { execSync } from 'child_process'

export async function runTechnicalAudit() {
  console.log('[technical] Starting audit...')
  const admin = createAdminClient()

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Recent git log (last 7 days)
  let gitLog = ''
  try {
    gitLog = execSync(
      'git log --oneline --since="7 days ago" --no-merges',
      { encoding: 'utf8', cwd: process.cwd() }
    ).slice(0, 3000)
  } catch {
    console.log('[technical] Skipping git log (not a git repo, likely Railway container)')
    gitLog = '[git log unavailable — no .git in container]'
  }

  // 2. npm audit
  let npmAuditOutput = ''
  let npmAuditHighCount = 0
  try {
    npmAuditOutput = execSync('npm audit --json 2>/dev/null || true', {
      encoding: 'utf8',
      cwd: process.cwd(),
    }).slice(0, 5000)

    try {
      const auditJson = JSON.parse(npmAuditOutput)
      const vulns = auditJson.metadata?.vulnerabilities ?? {}
      npmAuditHighCount = (vulns.high ?? 0) + (vulns.critical ?? 0)
      npmAuditOutput = `Critical: ${vulns.critical ?? 0}, High: ${vulns.high ?? 0}, Moderate: ${vulns.moderate ?? 0}, Low: ${vulns.low ?? 0}, Total: ${vulns.total ?? 0}`
    } catch {
      // JSON parse failed, keep raw output truncated
      npmAuditOutput = npmAuditOutput.slice(0, 500)
    }
  } catch {
    npmAuditOutput = '[npm audit unavailable]'
  }

  // 3. Failed API/function errors in last 24h (render_jobs errors)
  const { data: failedJobs } = await admin
    .from('render_jobs')
    .select('id, error_message, created_at')
    .eq('status', 'error')
    .gte('created_at', twentyFourHoursAgo)

  const failedCount24h = failedJobs?.length ?? 0

  // Error pattern analysis
  const errorPatterns: Record<string, number> = {}
  for (const job of failedJobs ?? []) {
    if (job.error_message) {
      const key = job.error_message.slice(0, 80)
      errorPatterns[key] = (errorPatterns[key] || 0) + 1
    }
  }

  // 4. Zombie/stuck render jobs
  const { count: stuckJobs } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'rendering', 'queued'])
    .lt('created_at', twentyFourHoursAgo)

  // 5. Database stats
  const { count: totalRenderJobs } = await admin
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { count: totalClips } = await admin
    .from('trending_clips')
    .select('id', { count: 'exact', head: true })

  // 6. Check for large/growing tables
  const { count: totalSnapshots } = await admin
    .from('clip_snapshots')
    .select('id', { count: 'exact', head: true })

  // 7. Recent webhook events health
  const { data: webhookEvents } = await admin
    .from('webhook_events')
    .select('id, event_type, status')
    .gte('created_at', twentyFourHoursAgo)

  const webhookFailures = (webhookEvents as { id: string; event_type: string; status: string }[] | null)
    ?.filter(e => e.status === 'failed').length ?? 0

  // 8. Build size check
  let buildInfo = ''
  try {
    buildInfo = execSync(
      'du -sh .next/ 2>/dev/null || echo "N/A"',
      { encoding: 'utf8', cwd: process.cwd() }
    ).trim()
  } catch {
    buildInfo = 'N/A'
  }

  // 9. Run agent
  const result = await runAgent({
    agent_type: 'technical',
    persona_prompt: 'a staff engineer at Stripe who reviews PRs for security, performance, and maintainability. You focus on real production issues: error rates, stuck jobs, security vulnerabilities, and database growth. You ignore cosmetic code style issues.',
    inputs: {
      git_log_7d: gitLog,
      npm_audit: npmAuditOutput,
      npm_audit_high_count: npmAuditHighCount,
      infrastructure: {
        failed_render_jobs_24h: failedCount24h,
        error_patterns: errorPatterns,
        stuck_jobs: stuckJobs ?? 0,
        total_render_jobs_7d: totalRenderJobs ?? 0,
        webhook_failures_24h: webhookFailures,
        total_webhook_events_24h: webhookEvents?.length ?? 0,
      },
      database: {
        total_trending_clips: totalClips ?? 0,
        total_clip_snapshots: totalSnapshots ?? 0,
        build_size: buildInfo,
      },
    },
  })

  // 10. Record metrics
  await insertMetricSnapshot({
    metric_name: 'failed_function_invocations_24h',
    metric_value: failedCount24h,
    metric_unit: 'count',
    regression_threshold_percent: 50,
  })
  await insertMetricSnapshot({
    metric_name: 'npm_audit_high_count',
    metric_value: npmAuditHighCount,
    metric_unit: 'count',
  })
  await insertMetricSnapshot({
    metric_name: 'stuck_render_jobs',
    metric_value: stuckJobs ?? 0,
    metric_unit: 'count',
  })

  console.log(`[technical] Done. ${result.findings.length} findings. Failed jobs 24h: ${failedCount24h}, npm vulns: ${npmAuditHighCount}`)
}

// Allow standalone execution
if (require.main === module) {
  runTechnicalAudit()
    .then(() => { console.log('[technical] Complete.'); process.exit(0) })
    .catch((err) => { console.error('[technical] Fatal:', err); process.exit(1) })
}
