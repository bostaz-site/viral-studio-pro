/**
 * Golden Render Test — nightly integrity check for the render pipeline.
 *
 * Queries the 3 most recent render_jobs with status done/degraded,
 * verifies each has a complete contract with all requested features applied.
 * Reports pass/fail to Discord and audit_metric_snapshots.
 *
 * Checks per render:
 *   - status is 'done' (not 'degraded')
 *   - contract exists and is a non-empty array
 *   - every requested feature was applied
 *   - no critical feature missing (voiceover, captions, hook_text)
 *
 * Run: npx tsx scripts/audits/golden-render-test.ts
 * Add to nightly batch: import from run-nightly.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface ContractEntry {
  feature: string
  requested: boolean
  applied: boolean
  reason: string | null
  meta: Record<string, unknown> | null
}

interface CheckResult {
  name: string
  passed: boolean
  detail: string
}

export async function runGoldenRenderTest(): Promise<{ passed: number; failed: number; total: number; results: CheckResult[] }> {
  const results: CheckResult[] = []

  // Fetch the 3 most recent completed renders (done or degraded)
  const { data: jobs, error } = await supabase
    .from('render_jobs')
    .select('id, status, contract, storage_path, quality_tier, created_at, debug_log')
    .in('status', ['done', 'degraded'])
    .order('created_at', { ascending: false })
    .limit(3)

  if (error || !jobs || jobs.length === 0) {
    results.push({ name: 'fetch_recent_renders', passed: false, detail: error?.message || 'No recent renders found' })
    return summarize(results)
  }

  results.push({ name: 'fetch_recent_renders', passed: true, detail: `${jobs.length} recent renders found` })

  for (const job of jobs) {
    const prefix = `render_${job.id.slice(0, 8)}`

    // Check 1: status should be 'done' (not 'degraded')
    results.push({
      name: `${prefix}_status`,
      passed: job.status === 'done',
      detail: job.status === 'done' ? 'done' : `DEGRADED — features missing`,
    })

    // Check 2: contract exists
    const contract = job.contract as ContractEntry[] | null
    if (!contract || !Array.isArray(contract) || contract.length === 0) {
      results.push({ name: `${prefix}_contract_exists`, passed: false, detail: 'No contract data' })
      continue
    }
    results.push({ name: `${prefix}_contract_exists`, passed: true, detail: `${contract.length} entries` })

    // Check 3: per-feature compliance
    for (const entry of contract) {
      if (!entry.requested) continue // not requested = not checked
      results.push({
        name: `${prefix}_${entry.feature}`,
        passed: entry.applied,
        detail: entry.applied ? 'applied' : `MISSING: ${entry.reason || 'unknown'}`,
      })
    }

    // Check 4: storage path exists
    results.push({
      name: `${prefix}_has_storage`,
      passed: !!job.storage_path,
      detail: job.storage_path ? 'yes' : 'no storage path',
    })

    // Check 5: quality tier
    results.push({
      name: `${prefix}_quality`,
      passed: job.quality_tier === 'HIGH_60' || job.quality_tier === 'HIGH_30',
      detail: job.quality_tier || 'unknown',
    })
  }

  // ── Compute feature application rates over the last 7 days ──
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentJobs } = await supabase
    .from('render_jobs')
    .select('contract')
    .in('status', ['done', 'degraded'])
    .gte('created_at', weekAgo)
    .not('contract', 'is', null)

  if (recentJobs && recentJobs.length > 0) {
    const featureStats: Record<string, { requested: number; applied: number }> = {}
    for (const j of recentJobs) {
      const c = j.contract as ContractEntry[]
      if (!Array.isArray(c)) continue
      for (const e of c) {
        if (!featureStats[e.feature]) featureStats[e.feature] = { requested: 0, applied: 0 }
        if (e.requested) {
          featureStats[e.feature].requested++
          if (e.applied) featureStats[e.feature].applied++
        }
      }
    }

    for (const [feat, stats] of Object.entries(featureStats)) {
      if (stats.requested === 0) continue
      const rate = Math.round((stats.applied / stats.requested) * 100)
      results.push({
        name: `7d_rate_${feat}`,
        passed: rate >= 50, // alert if less than 50% application rate
        detail: `${rate}% applied (${stats.applied}/${stats.requested})`,
      })
    }
  }

  return summarize(results)
}

function summarize(results: CheckResult[]) {
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  return { passed, failed, total: results.length, results }
}

// ── Main: run and report ──

async function main() {
  console.log('[GoldenRender] Starting golden render test...')
  const { passed, failed, total, results } = await runGoldenRenderTest()

  console.log(`\n[GoldenRender] Results: ${passed}/${total} passed, ${failed} failed\n`)
  for (const r of results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`)
  }

  // Store in audit_metric_snapshots
  try {
    await supabase.from('audit_metric_snapshots').insert({
      agent: 'golden_render_test',
      metric_name: 'render_contract_compliance',
      metric_value: total > 0 ? Math.round((passed / total) * 100) : 0,
      metadata: {
        passed,
        failed,
        total,
        failures: results.filter(r => !r.passed).map(r => ({ name: r.name, detail: r.detail })),
      },
    })
  } catch (e) {
    console.warn('[GoldenRender] Failed to store metric:', (e as Error).message)
  }

  // Discord alert
  const webhookUrl = failed > 0
    ? process.env.DISCORD_AUDIT_WEBHOOK_URL  // critical-alerts for failures
    : process.env.DISCORD_ACTIVITY_CHANNEL_ID ? undefined : process.env.DISCORD_AUDIT_WEBHOOK_URL

  if (webhookUrl) {
    try {
      const failureLines = results
        .filter(r => !r.passed)
        .map(r => `  FAIL ${r.name}: ${r.detail}`)
        .join('\n')

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: failed > 0
            ? `**[Golden Render Test] ${passed}/${total} checks passed, ${failed} FAILED**\n\`\`\`\n${failureLines}\n\`\`\``
            : `**[Golden Render Test] ${passed}/${total} checks passed** — all features applied correctly`,
        }),
      })
    } catch { /* non-critical */ }
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[GoldenRender] Fatal error:', err)
  process.exit(1)
})
