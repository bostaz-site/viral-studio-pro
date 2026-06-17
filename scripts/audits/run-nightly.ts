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

import { generateMorningBrief } from '../../lib/audit/morning-brief'

// Agent imports — these may not exist yet (prompts #2 and #3 pending).
// We wrap them in dynamic imports with graceful fallback.
type AuditFn = () => Promise<unknown>

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

const dayOfWeek = new Date().getDay() // 0=Dim, 1=Lun, ..., 6=Sam

async function main() {
  console.log(
    `[${new Date().toISOString()}] Starting nightly audit (day ${dayOfWeek})`
  )

  // Output quality runs every day
  const outputAgent = await tryImport('./output-quality', 'runOutputQualityAudit')
  if (outputAgent) await safeRun(outputAgent, 'output-quality')

  // System agents rotate per weekday
  const systemSchedule: Record<number, { path: string; fn: string }[]> = {
    1: [{ path: './acquisition', fn: 'runAcquisitionAudit' }],
    2: [{ path: './activation', fn: 'runActivationAudit' }],
    3: [{ path: './technical', fn: 'runTechnicalAudit' }],
    4: [{ path: './retention', fn: 'runRetentionAudit' }],
    5: [], // Friday: strategic synthesis (phase 2)
    6: [], // Saturday: rest
    0: [], // Sunday: rest
  }

  for (const agent of systemSchedule[dayOfWeek] ?? []) {
    const fn = await tryImport(agent.path, agent.fn)
    if (fn) await safeRun(fn, agent.fn)
  }

  // Random personas (2 on weekdays, 1 on weekends)
  const personaDefs = [
    {
      path: '../personas/sceptical-first-timer',
      fn: 'runScepticalPersona',
    },
    {
      path: '../personas/free-user-limit',
      fn: 'runFreeLimitPersona',
    },
    {
      path: '../personas/power-user',
      fn: 'runPowerUserPersona',
    },
  ]

  const numPersonas = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 2
  const picked = pickRandom(personaDefs, numPersonas)

  for (const p of picked) {
    const fn = await tryImport(p.path, p.fn)
    if (fn) await safeRun(fn, p.fn)
  }

  // Generate morning brief (summarizes all findings)
  await safeRun(() => generateMorningBrief(), 'morning-brief')

  console.log(`[${new Date().toISOString()}] Nightly audit complete`)
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

async function safeRun(fn: () => Promise<unknown>, name: string) {
  try {
    console.log(`[nightly] Running ${name}...`)
    await fn()
    console.log(`[nightly] ${name} done`)
  } catch (err) {
    console.error(`[nightly] ${name} failed:`, err)
    // Don't throw — keep going with other agents
  }
}

main().catch(console.error)
