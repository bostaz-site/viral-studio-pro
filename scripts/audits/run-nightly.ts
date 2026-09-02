/**
 * Master nightly orchestrator
 *
 * ACTIVE agents (product-focused):
 *   Every day: Output Quality, Technical, Activation
 *   + 1-2 random personas
 *   + Morning Brief → Discord #morning-brief
 *
 * PAUSED agents (acquisition — enable when growth machine starts):
 *   Acquisition, Cold Email, Revenue, AI Scout, AI Multiplier,
 *   Meta-Agent, Strategist, Strategic Brief
 *   → To re-enable: set ENABLE_ACQUISITION_AGENTS=true in .env.local
 *
 * Run: npx tsx scripts/audits/run-nightly.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

type AuditFn = () => Promise<unknown>

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const ENABLE_ACQUISITION = process.env.ENABLE_ACQUISITION_AGENTS === 'true'

interface RunStats {
  agentsRun: number
  agentsFailed: number
  startTime: number
  errors: string[]
}

const stats: RunStats = {
  agentsRun: 0,
  agentsFailed: 0,
  startTime: Date.now(),
  errors: [],
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

// ── Heartbeat: write every execution to DB ─────────────────────────────────

async function writeHeartbeat(status: 'running' | 'completed' | 'failed', summary?: string) {
  try {
    await supabase
      .from('lab_agent_status')
      .upsert({
        id: 'nightly-audits',
        status,
        last_heartbeat_at: new Date().toISOString(),
        hostname: require('os').hostname(),
        version: '2.0.0',
        total_executions: status === 'completed' ? stats.agentsRun : undefined,
        last_error: status === 'failed' ? (summary ?? stats.errors[0] ?? 'unknown') : null,
        last_error_at: status === 'failed' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
  } catch (err) {
    console.error('[nightly] Heartbeat write failed:', err)
  }
}

// ── Discord notifications ──────────────────────────────────────────────────

async function postDiscord(channelEnv: string, embed: {
  title: string
  description: string
  color: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}) {
  // Try bot API first, fall back to webhook
  const botToken = process.env.DISCORD_BOT_TOKEN
  const channelId = process.env[channelEnv]

  if (botToken && channelId) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            ...embed,
            footer: { text: 'Viral Animal Nightly' },
            timestamp: new Date().toISOString(),
          }],
        }),
      })
      if (res.ok) return
      console.warn(`[discord] Bot send failed (${res.status})`)
    } catch { /* fall through */ }
  }

  // Webhook fallback
  const webhook = process.env.DISCORD_AUDIT_WEBHOOK_URL
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            ...embed,
            footer: { text: 'Viral Animal Nightly' },
            timestamp: new Date().toISOString(),
          }],
        }),
      })
    } catch { /* best effort */ }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log(`[${new Date().toISOString()}] Nightly audit START`)
  console.log(`  Day: ${dayNames[dayOfWeek]} (${dayOfWeek})`)
  console.log(`  Acquisition agents: ${ENABLE_ACQUISITION ? 'ENABLED' : 'PAUSED'}`)
  console.log('='.repeat(60))

  await writeHeartbeat('running')

  // ── Active agents: product-focused (run every day) ──

  const outputAgent = await tryImport('./output-quality', 'runOutputQualityAudit')
  if (outputAgent) await safeRun(outputAgent, 'output-quality')

  const technicalAgent = await tryImport('./technical', 'runTechnicalAudit')
  if (technicalAgent) await safeRun(technicalAgent, 'technical')

  // Migration drift check (lightweight, no LLM)
  try {
    const { execSync } = await import('child_process')
    const out = execSync('npx tsx scripts/check-migrations.ts', { timeout: 30000, encoding: 'utf-8' })
    console.log('[nightly] Migration check:', out.includes('MISSING') ? 'DRIFT DETECTED' : 'OK')
  } catch { console.warn('[nightly] Migration check failed or found missing migrations') }

  const activationAgent = await tryImport('./activation', 'runActivationAudit')
  if (activationAgent) await safeRun(activationAgent, 'activation')

  // Production errors agent
  const prodErrorsAgent = await tryImport('./production-errors-agent', 'runProductionErrorsAudit')
  if (prodErrorsAgent) await safeRun(prodErrorsAgent, 'production-errors')

  // ── Acquisition agents: PAUSED by default ──

  if (ENABLE_ACQUISITION) {
    const acqSchedule: Record<number, { path: string; fn: string }[]> = {
      1: [{ path: './acquisition', fn: 'runAcquisitionAudit' }],
      2: [{ path: './ai-scout', fn: 'runAIScout' }, { path: './ai-multiplier', fn: 'runAIMultiplier' }],
      4: [{ path: './retention', fn: 'runRetentionAudit' }],
      5: [{ path: './cold-email', fn: 'runColdEmailAudit' }],
      6: [{ path: './ai-scout', fn: 'runAIScout' }, { path: './ai-multiplier', fn: 'runAIMultiplier' }],
      0: [{ path: './strategist', fn: 'runStrategist' }, { path: './revenue-agent', fn: 'runRevenueAgent' }, { path: './meta-agent', fn: 'runMetaAgent' }],
    }
    for (const agent of acqSchedule[dayOfWeek] ?? []) {
      const fn = await tryImport(agent.path, agent.fn)
      if (fn) await safeRun(fn, agent.fn)
    }

    // Sunday: strategic brief
    if (dayOfWeek === 0) {
      try {
        const { generateStrategicBrief } = await import('../../lib/audit/strategic-brief')
        await generateStrategicBrief()
        console.log('[nightly] Strategic brief generated')
      } catch (err) {
        console.error('[nightly] Strategic brief failed:', err)
      }
    }
  }

  // ── Personas (1-2 random) ──

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

  // ── Post-processing agents (daily) ──

  const autoPromptFn = await tryImport('./auto-prompt-generator', 'runAutoPromptGenerator')
  if (autoPromptFn) await safeRun(autoPromptFn, 'auto-prompt-generator')

  const rootCauseFn = await tryImport('./root-cause-detector', 'runRootCauseDetector')
  if (rootCauseFn) await safeRun(rootCauseFn, 'root-cause-detector')

  const outcomeFn = await tryImport('./outcome-measurer', 'runOutcomeMeasurer')
  if (outcomeFn) await safeRun(outcomeFn, 'outcome-measurer')

  const prReviewFn = await tryImport('./recent-pr-review', 'runRecentPRReview')
  if (prReviewFn) await safeRun(prReviewFn, 'recent-pr-review')

  // ── Morning brief → Discord ──

  console.log('\n--- Morning brief ---')
  try {
    const { generateMorningBrief } = await import('../../lib/audit/morning-brief')
    const brief = await generateMorningBrief()

    // Post to Discord #morning-brief (short mobile-friendly summary)
    const lines = brief.split('\n').filter(l => l.trim())
    const shortBrief = lines.slice(0, 30).join('\n').slice(0, 1900)

    await postDiscord('DISCORD_MORNING_BRIEF_CHANNEL_ID', {
      title: `Morning Brief — ${new Date().toISOString().slice(0, 10)}`,
      description: shortBrief,
      color: 0x22d3ee,
    })
    console.log('[nightly] Morning brief generated and posted to Discord')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[nightly] Morning brief failed:', msg)
    stats.agentsFailed++
    stats.errors.push(`morning-brief: ${msg}`)
  }

  // ── Final summary ──

  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1)
  const status = stats.agentsFailed === stats.agentsRun && stats.agentsRun > 0 ? 'failed' : 'completed'
  await writeHeartbeat(status, stats.errors.join('; ').slice(0, 500))

  console.log('\n' + '='.repeat(60))
  console.log(`[${new Date().toISOString()}] Nightly audit COMPLETE`)
  console.log(`  Duration: ${elapsed}s`)
  console.log(`  Agents run: ${stats.agentsRun}`)
  console.log(`  Agents failed: ${stats.agentsFailed}`)
  console.log('='.repeat(60))

  // Discord summary to #critical-alerts
  if (stats.agentsFailed > 0) {
    await postDiscord('DISCORD_CRITICAL_ALERTS_CHANNEL_ID', {
      title: `Nightly audit: ${stats.agentsFailed}/${stats.agentsRun} agents failed`,
      description: stats.errors.slice(0, 5).join('\n').slice(0, 500),
      color: 0xef4444,
    })
  }

  if (stats.agentsRun > 0 && stats.agentsFailed === stats.agentsRun) {
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
    await fn()
    const ms = Date.now() - start
    console.log(`[nightly] ${name} done (${(ms / 1000).toFixed(1)}s)`)
  } catch (err) {
    stats.agentsFailed++
    const ms = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    stats.errors.push(`${name}: ${msg.slice(0, 200)}`)
    console.error(`[nightly] ${name} FAILED after ${(ms / 1000).toFixed(1)}s:`, msg)
  }
}

// ── Uncaught exception guard ─────────────────────────────────────────────────

process.on('uncaughtException', async (err) => {
  console.error('[nightly] UNCAUGHT EXCEPTION:', err)
  await writeHeartbeat('failed', `UNCAUGHT: ${err.message}`)
  await postDiscord('DISCORD_CRITICAL_ALERTS_CHANNEL_ID', {
    title: 'Nightly audit CRASHED',
    description: `\`\`\`${err.message.slice(0, 300)}\n${err.stack?.slice(0, 200) ?? ''}\`\`\``,
    color: 0xff0000,
  })
  process.exit(1)
})

main().catch(async (err) => {
  console.error('[nightly] Fatal error:', err)
  await writeHeartbeat('failed', err instanceof Error ? err.message : String(err))
  await postDiscord('DISCORD_CRITICAL_ALERTS_CHANNEL_ID', {
    title: 'Nightly audit CRASHED',
    description: `Fatal: ${err instanceof Error ? err.message.slice(0, 300) : String(err)}`,
    color: 0xff0000,
  }).catch(() => {})
  process.exit(1)
})
