/**
 * Master nightly orchestrator
 *
 * Schedule:
 *   Lundi    (1) - Output + Acquisition + 2 random personas
 *   Mardi    (2) - Output + Activation  + 2 random personas
 *   Mercredi (3) - Output + Technical   + 2 random personas
 *   Jeudi    (4) - Output + Retention   + 2 random personas
 *   Vendredi (5) - Output + Strategic   + 2 random personas
 *   Samedi   (6) - Output + 1 persona
 *   Dimanche (0) - Output + 1 persona
 *
 * Run: npx tsx scripts/audits/run-nightly.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateMorningBrief } from '../../lib/audit/morning-brief'

type AuditFn = () => Promise<unknown>

interface RunStats {
  agentsRun: number
  agentsFailed: number
  findingsCreated: number
  startTime: number
}

const stats: RunStats = {
  agentsRun: 0,
  agentsFailed: 0,
  findingsCreated: 0,
  startTime: Date.now(),
}

async function tryImport(
  modulePath: string,
  exportName: string
): Promise<AuditFn | null> {
  try {
    const mod = await import(modulePath)
    if (typeof mod[exportName] === 'function') return mod[exportName]
    console.warn(`[nightly] ${modulePath} has no export "${exportName}"`)
    return null
  } catch {
    console.warn(`[nightly] ${modulePath} not found yet (pending prompt merge)`)
    return null
  }
}

const dayOfWeek = new Date().getDay()
const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

async function main() {
  console.log('='.repeat(60))
  console.log(`[${new Date().toISOString()}] Nightly audit START`)
  console.log(`  Day: ${dayNames[dayOfWeek]} (${dayOfWeek})`)
  console.log('='.repeat(60))

  // Output quality runs every day
  const outputAgent = await tryImport('./output-quality', 'runOutputQualityAudit')
  if (outputAgent) await safeRun(outputAgent, 'output-quality')

  // System agents rotate per weekday
  const systemSchedule: Record<number, { path: string; fn: string }[]> = {
    1: [{ path: './acquisition', fn: 'runAcquisitionAudit' }],
    2: [{ path: './activation', fn: 'runActivationAudit' }],
    3: [{ path: './technical', fn: 'runTechnicalAudit' }],
    4: [{ path: './retention', fn: 'runRetentionAudit' }],
    5: [],
    6: [],
    0: [],
  }

  for (const agent of systemSchedule[dayOfWeek] ?? []) {
    const fn = await tryImport(agent.path, agent.fn)
    if (fn) await safeRun(fn, agent.fn)
  }

  // Random personas (2 on weekdays, 1 on weekends)
  const personaDefs = [
    { path: '../personas/sceptical-first-timer', fn: 'runScepticalPersona' },
    { path: '../personas/free-user-limit', fn: 'runFreeLimitPersona' },
    { path: '../personas/power-user', fn: 'runPowerUserPersona' },
  ]

  const numPersonas = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 2
  const picked = pickRandom(personaDefs, numPersonas)

  for (const p of picked) {
    const fn = await tryImport(p.path, p.fn)
    if (fn) await safeRun(fn, p.fn)
  }

  // Generate morning brief
  console.log('\n--- Morning brief ---')
  let briefSaved = false
  try {
    const brief = await generateMorningBrief()
    briefSaved = true
    console.log('[nightly] Morning brief generated')
    console.log(brief.slice(0, 300) + '...')
  } catch (err) {
    console.error('[nightly] Morning brief failed:', err)
    stats.agentsFailed++
  }

  // Also trigger the API endpoint so it's cached/accessible via dashboard
  await triggerBriefAPI()

  // Final summary
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(60))
  console.log(`[${new Date().toISOString()}] Nightly audit COMPLETE`)
  console.log(`  Duration: ${elapsed}s`)
  console.log(`  Agents run: ${stats.agentsRun}`)
  console.log(`  Agents failed: ${stats.agentsFailed}`)
  console.log(`  Brief saved: ${briefSaved ? 'yes' : 'no'}`)
  console.log('='.repeat(60))

  // Exit with error code if all agents failed
  if (stats.agentsRun > 0 && stats.agentsFailed === stats.agentsRun) {
    console.error('[nightly] All agents failed — exiting with error')
    process.exit(1)
  }
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

async function safeRun(fn: () => Promise<unknown>, name: string) {
  stats.agentsRun++
  const start = Date.now()
  try {
    console.log(`\n--- ${name} ---`)
    console.log(`[nightly] Running ${name}...`)
    await fn()
    const ms = Date.now() - start
    console.log(`[nightly] ${name} done (${(ms / 1000).toFixed(1)}s)`)
  } catch (err) {
    stats.agentsFailed++
    const ms = Date.now() - start
    console.error(`[nightly] ${name} FAILED after ${(ms / 1000).toFixed(1)}s:`, err)
  }
}

async function triggerBriefAPI() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'
  const cronSecret = process.env.AUDIT_CRON_SECRET

  if (!cronSecret) {
    console.log('[nightly] AUDIT_CRON_SECRET not set, skipping API trigger')
    return
  }

  try {
    const res = await fetch(`${appUrl}/api/admin/audits/trigger?mode=brief`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      console.log('[nightly] Brief API triggered successfully')
    } else {
      console.warn(`[nightly] Brief API returned ${res.status}`)
    }
  } catch (err) {
    console.warn('[nightly] Brief API trigger failed (non-blocking):', err)
  }
}

main().catch((err) => {
  console.error('[nightly] Fatal error:', err)
  process.exit(1)
})
