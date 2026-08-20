/**
 * Lab Agent — Local daemon that auto-executes accepted Lab dives.
 *
 * - Polls Supabase every 30s for accepted dives with no PR yet
 * - Spawns Claude Code CLI (uses Max subscription — $0)
 * - Creates branch, commits, pushes, creates PR via gh CLI
 * - Pings Discord with PR URL
 * - Heartbeats Supabase every 60s so dashboard shows "online"
 *
 * Usage:
 *   npm run lab:agent          — Run in foreground
 *   npm run lab:agent:install  — Install as Windows Service (auto-start on boot)
 *
 * Prerequisites (one-time):
 *   claude /login              — Authenticate CLI with Max subscription
 *   gh auth login              — Authenticate GitHub CLI
 */

import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

config({ path: path.resolve(__dirname, '..', '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[agent] Missing SUPABASE env vars in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const POLL_INTERVAL_MS = 30_000
const HEARTBEAT_INTERVAL_MS = 60_000
const REPO_PATH = path.resolve(__dirname, '..', '..')
const AGENT_VERSION = '1.0.0'
const HOSTNAME = os.hostname()

let isProcessing = false

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function heartbeat(status: 'online' | 'busy' | 'paused' = 'online') {
  await supabase
    .from('lab_agent_status')
    .upsert({
      id: 'singleton',
      status,
      last_heartbeat_at: new Date().toISOString(),
      hostname: HOSTNAME,
      version: AGENT_VERSION,
      updated_at: new Date().toISOString(),
    })
}

async function findNextAcceptedDive() {
  // Find dives that are accepted but haven't been auto-executed yet
  const { data } = await supabase
    .from('lab_deep_dives')
    .select('*')
    .eq('user_action', 'accepted')
    .in('status', ['completed', 'pr_ready_failed'])
    .is('auto_pr_url', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return data
}

async function checkPaused(): Promise<boolean> {
  const { data } = await supabase
    .from('lab_agent_status')
    .select('status')
    .eq('id', 'singleton')
    .single()
  return data?.status === 'paused'
}

// ── Prompt file helpers ───────────────────────────────────────────────────────

async function ensurePromptFileExists(dive: Record<string, unknown>): Promise<string | null> {
  // Check accepted_prompt_path first
  if (dive.accepted_prompt_path) {
    const fullPath = path.join(REPO_PATH, dive.accepted_prompt_path as string)
    try {
      await fs.access(fullPath)
      return dive.accepted_prompt_path as string
    } catch {
      // File doesn't exist locally — will generate below
    }
  }

  // Generate prompt from dive data using the shared utility
  const { generateLabPrompt, buildPromptFilePath } = await import('../../lib/lab/generate-prompt')
  const prompt = generateLabPrompt(dive)
  const { filepath } = buildPromptFilePath(dive as { feature_area: string; cycle_number: number; final_recommendation?: string | null })
  const fullPath = path.join(REPO_PATH, filepath)

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, prompt, 'utf-8')
  console.log(`[agent] Generated prompt file: ${filepath}`)

  // Update DB with the path
  await supabase
    .from('lab_deep_dives')
    .update({ accepted_prompt_path: filepath })
    .eq('id', dive.id)

  return filepath
}

// ── Git lock cleanup ─────────────────────────────────────────────────────────

/**
 * Remove stale .lock files in .git/ that block git operations.
 * A lock older than 5 minutes is considered stale (orphaned by a crashed process).
 */
async function cleanGitLocks() {
  const gitDir = path.join(REPO_PATH, '.git')
  const lockFiles = [
    'index.lock', 'ORIG_HEAD.lock', 'HEAD.lock',
    'refs/heads/master.lock', 'config.lock',
  ]
  for (const lockFile of lockFiles) {
    const lockPath = path.join(gitDir, lockFile)
    try {
      const stat = await fs.stat(lockPath)
      const ageMs = Date.now() - stat.mtimeMs
      if (ageMs > 5 * 60_000) {
        await fs.unlink(lockPath)
        console.log(`[agent] Removed stale git lock: ${lockFile} (age: ${Math.round(ageMs / 60_000)}min)`)
      } else {
        console.warn(`[agent] Git lock exists but is recent (${Math.round(ageMs / 1000)}s): ${lockFile} — skipping`)
      }
    } catch {
      // File doesn't exist — good
    }
  }
}

// ── Shell execution ───────────────────────────────────────────────────────────

// Resolve claude.exe full path once (shell:false needs it on Windows)
let CLAUDE_EXE: string | null = null
function getClaudeExe(): string {
  if (CLAUDE_EXE) return CLAUDE_EXE
  try {
    const { execSync } = require('child_process')
    CLAUDE_EXE = String(execSync('where claude', { encoding: 'utf-8' })).trim().split('\n')[0].trim()
  } catch {
    CLAUDE_EXE = 'claude'
  }
  return CLAUDE_EXE
}

function execCapture(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // shell:true ONLY for .cmd wrappers (npm/npx). git is a real .exe — shell:false
    // prevents cmd.exe from splitting multi-word args (bug: "pathspec 'lab' did not match")
    const needsShell = cmd === 'npm' || cmd === 'npx'
    const child = spawn(cmd, args, { cwd: REPO_PATH, shell: needsShell })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c.toString()))
    child.stderr.on('data', (c) => (stderr += c.toString()))
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}: ${stderr.slice(0, 500)}`))
    })
    child.on('error', reject)
  })
}

function runClaudeCode(promptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.ANTHROPIC_API_KEY

    const promptText = `Read the file "${promptPath}" and implement everything described in the "Final Recommendation" section. Address the Kill Switch concerns. Do NOT commit or push — the agent handles that. Just modify the source files and exit when done.`

    // CRITICAL: shell:false + full exe path prevents cmd.exe from mangling args
    const claudeExe = getClaudeExe()
    console.log(`[agent] Spawning: ${claudeExe} on ${promptPath}`)

    const child = spawn(claudeExe, [
      '-p', promptText,
      '--model', 'claude-sonnet-4-6',
      '--max-turns', '50',
      '--output-format', 'text',
      '--dangerously-skip-permissions',
    ], {
      cwd: REPO_PATH,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const startedAt = Date.now()
    let lastOutputAt = Date.now()
    let progressInterval: NodeJS.Timeout | null = null

    child.stdout.on('data', (chunk) => {
      lastOutputAt = Date.now()
      process.stdout.write(`[claude] ${chunk}`)
    })
    child.stderr.on('data', (chunk) => {
      lastOutputAt = Date.now()
      process.stderr.write(`[claude] ${chunk}`)
    })

    // Progress logger every 5 min so we know it's still alive
    progressInterval = setInterval(() => {
      const totalMin = Math.round((Date.now() - startedAt) / 60_000)
      const silenceMin = Math.round((Date.now() - lastOutputAt) / 60_000)
      console.log(`[agent] ⏱️  claude running ${totalMin}min · last output ${silenceMin}min ago`)
    }, 5 * 60_000)

    // Watchdog: kill if silent for 30 min (claude can think silently on big recos)
    // OR total runtime > 60 min hard kill
    const watchdog = setInterval(() => {
      const silenceMs = Date.now() - lastOutputAt
      const totalMs = Date.now() - startedAt

      if (silenceMs > 30 * 60_000) {
        console.error(`[agent] Claude CLI silent for 30 min — killing`)
        child.kill('SIGTERM')
        clearInterval(watchdog)
        if (progressInterval) clearInterval(progressInterval)
      } else if (totalMs > 60 * 60_000) {
        console.error(`[agent] Claude CLI runtime > 60 min — hard killing`)
        child.kill('SIGKILL')
        clearInterval(watchdog)
        if (progressInterval) clearInterval(progressInterval)
      }
    }, 60_000)

    child.on('close', (code) => {
      clearInterval(watchdog)
      if (progressInterval) clearInterval(progressInterval)
      const totalMin = Math.round((Date.now() - startedAt) / 60_000)
      console.log(`[agent] claude exited after ${totalMin}min with code ${code}`)
      if (code === 0) resolve()
      else reject(new Error(`Claude CLI exited with code ${code} after ${totalMin}min`))
    })
    child.on('error', (err) => {
      clearInterval(watchdog)
      if (progressInterval) clearInterval(progressInterval)
      reject(err)
    })
  })
}

// ── Discord notifications ─────────────────────────────────────────────────────

async function notifyDiscord(embed: {
  title: string
  description: string
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  color: number
  footer?: string
}) {
  const webhook = process.env.DISCORD_PR_READY_WEBHOOK ?? process.env.DISCORD_LAB_WEBHOOK_URL
  if (!webhook) return

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          ...embed,
          footer: embed.footer ? { text: embed.footer } : undefined,
          timestamp: new Date().toISOString(),
        }],
      }),
    })
  } catch (err) {
    console.error('[agent] Discord notify failed:', err)
  }
}

// ── GitHub PR creation ────────────────────────────────────────────────────────

async function createPullRequest(title: string, body: string, head: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN env var required for PR creation')

  const res = await fetch('https://api.github.com/repos/bostaz-site/viral-studio-pro/pulls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, head, base: 'master' }),
  })

  const data = await res.json() as { html_url?: string; message?: string }
  if (!res.ok || !data.html_url) {
    throw new Error(`GitHub PR creation failed: ${data.message ?? res.status}`)
  }
  return data.html_url
}

// ── Core: process one dive ────────────────────────────────────────────────────

async function processOneDive(dive: Record<string, unknown>) {
  const featureArea = dive.feature_area as string
  const diveId = dive.id as string
  const cycleNumber = dive.cycle_number as number

  console.log(`\n[agent] Processing: ${featureArea} cycle #${cycleNumber} (${diveId})`)
  isProcessing = true

  try {
    await supabase
      .from('lab_agent_status')
      .update({ status: 'busy', current_dive_id: diveId })
      .eq('id', 'singleton')

    await supabase
      .from('lab_deep_dives')
      .update({ status: 'executing' })
      .eq('id', diveId)

    // 1. Ensure prompt file
    const promptPath = await ensurePromptFileExists(dive)
    if (!promptPath) throw new Error('Could not find or generate prompt file')

    // 2. Git: cleanup stale locks, checkout fresh branch from latest master
    await cleanGitLocks()
    await execCapture('git', ['checkout', 'master'])
    await execCapture('git', ['pull', 'origin', 'master'])
    const branch = `lab/${featureArea}-${Date.now()}`
    await execCapture('git', ['checkout', '-b', branch])

    // 3. Run Claude Code
    await runClaudeCode(promptPath)

    // 4. Check for changes
    const { stdout: status } = await execCapture('git', ['status', '--porcelain'])
    if (!status.trim()) {
      console.warn(`[agent] No changes for ${featureArea}`)
      await supabase
        .from('lab_deep_dives')
        .update({ status: 'pr_ready_failed' })
        .eq('id', diveId)
      await notifyDiscord({
        title: 'Lab agent: no changes',
        description: `**${featureArea}** — Claude Code made no modifications`,
        color: 0xFFFF00,
        footer: `Lab Agent · ${HOSTNAME}`,
      })
      return
    }

    // 5. Build check
    let buildOk = true
    try {
      await execCapture('npm', ['run', 'build'])
    } catch {
      buildOk = false
      console.warn('[agent] Build failed — continuing anyway')
    }

    // 6. Commit + push — message via temp file (-F): Windows cmd.exe mangles multi-word -m
    await execCapture('git', ['add', '-A'])
    const commitMsg = `feat(${featureArea}): lab cycle ${cycleNumber} auto-execute\n\nFrom: ${promptPath}\nDive: ${diveId}\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>`
    const msgFile = path.join(os.tmpdir(), `lab-commit-${Date.now()}.txt`)
    await fs.writeFile(msgFile, commitMsg, 'utf-8')
    try {
      await execCapture('git', ['commit', '-F', msgFile])
    } finally {
      await fs.unlink(msgFile).catch(() => {})
    }
    await execCapture('git', ['push', 'origin', branch])

    // 7. Create PR via GitHub API
    const prBody = [
      `## Auto-executed Lab recommendation`,
      ``,
      `**Feature**: ${featureArea}`,
      `**Cycle**: #${cycleNumber}`,
      `**Prompt**: \`${promptPath}\``,
      `**Build**: ${buildOk ? 'passes' : 'check logs'}`,
      `**Agent**: ${HOSTNAME}`,
      ``,
      `## Review checklist`,
      `- [ ] Kill Switch addressed`,
      `- [ ] Build passes`,
      `- [ ] No regressions`,
      `- [ ] Ship-it`,
      ``,
      `---`,
      `Auto-executed by Lab Agent v${AGENT_VERSION}`,
    ].join('\n')

    const cleanPrUrl = await createPullRequest(
      `Lab: ${featureArea} cycle ${cycleNumber}`,
      prBody,
      branch,
    )
    console.log(`[agent] PR created: ${cleanPrUrl}`)

    // 8. Update DB
    await supabase
      .from('lab_deep_dives')
      .update({ status: 'pr_ready', auto_pr_url: cleanPrUrl })
      .eq('id', diveId)

    // Increment execution count
    const { data: agentData } = await supabase
      .from('lab_agent_status')
      .select('total_executions')
      .eq('id', 'singleton')
      .single()
    await supabase
      .from('lab_agent_status')
      .update({
        total_executions: (agentData?.total_executions ?? 0) + 1,
        current_dive_id: null,
      })
      .eq('id', 'singleton')

    // 9. Discord notification
    await notifyDiscord({
      title: 'Lab PR ready for review',
      description: `**${featureArea}** auto-executed by Lab Agent`,
      fields: [
        { name: 'PR', value: cleanPrUrl, inline: false },
        { name: 'Build', value: buildOk ? 'passes' : 'check logs', inline: true },
        { name: 'Branch', value: branch, inline: true },
      ],
      color: 0x00DDFF,
      footer: `Lab Agent v${AGENT_VERSION} · ${HOSTNAME}`,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[agent] Error processing ${featureArea}:`, errMsg)

    await supabase
      .from('lab_deep_dives')
      .update({ status: 'pr_ready_failed' })
      .eq('id', diveId)

    await supabase
      .from('lab_agent_status')
      .update({
        last_error: errMsg.slice(0, 1000),
        last_error_at: new Date().toISOString(),
        current_dive_id: null,
      })
      .eq('id', 'singleton')

    await notifyDiscord({
      title: 'Lab agent: execution failed',
      description: `**${featureArea}** failed`,
      fields: [{ name: 'Error', value: errMsg.slice(0, 500), inline: false }],
      color: 0xFF0000,
      footer: `Lab Agent · ${HOSTNAME}`,
    })

    // Return to master so next poll starts clean
    try { await execCapture('git', ['checkout', 'master']) } catch { /* ignore */ }
  } finally {
    isProcessing = false
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function mainLoop() {
  console.log(`[agent] Lab Agent v${AGENT_VERSION} starting on ${HOSTNAME}`)
  console.log(`[agent] Repo: ${REPO_PATH}`)
  console.log(`[agent] Polling every ${POLL_INTERVAL_MS / 1000}s`)

  await heartbeat('online')
  await notifyDiscord({
    title: 'Lab Agent online',
    description: `Daemon started on ${HOSTNAME}`,
    color: 0x00FF00,
    footer: `Lab Agent v${AGENT_VERSION}`,
  })

  // Heartbeat timer
  setInterval(() => {
    heartbeat(isProcessing ? 'busy' : 'online').catch(() => {})
  }, HEARTBEAT_INTERVAL_MS)

  // Poll loop
  while (true) {
    try {
      if (await checkPaused()) {
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      if (!isProcessing) {
        const dive = await findNextAcceptedDive()
        if (dive) {
          await processOneDive(dive)
          // Return to master after processing
          try { await execCapture('git', ['checkout', 'master']) } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('[agent] Poll error:', err)
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Graceful shutdown
async function shutdown() {
  console.log('[agent] Shutting down...')
  await supabase
    .from('lab_agent_status')
    .update({ status: 'offline', current_dive_id: null })
    .eq('id', 'singleton')
  await notifyDiscord({
    title: 'Lab Agent offline',
    description: `Daemon stopped on ${HOSTNAME}`,
    color: 0xFF0000,
    footer: `Lab Agent v${AGENT_VERSION}`,
  })
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Crash guard: log + notify on unhandled exceptions instead of dying silently
process.on('uncaughtException', async (err) => {
  console.error('[agent] UNCAUGHT EXCEPTION:', err)
  await supabase
    .from('lab_agent_status')
    .update({
      status: 'offline',
      last_error: `UNCAUGHT: ${err.message}`.slice(0, 1000),
      last_error_at: new Date().toISOString(),
      current_dive_id: null,
    })
    .eq('id', 'singleton')
  await notifyDiscord({
    title: 'Lab Agent CRASHED',
    description: `Uncaught exception on ${HOSTNAME}:\n\`\`\`${err.message.slice(0, 300)}\`\`\``,
    color: 0xFF0000,
    footer: `Lab Agent v${AGENT_VERSION}`,
  })
  process.exit(1)
})

mainLoop().catch(async (err) => {
  console.error('[agent] Fatal:', err)
  await notifyDiscord({
    title: 'Lab Agent CRASHED',
    description: `Fatal error on ${HOSTNAME}:\n\`\`\`${err instanceof Error ? err.message.slice(0, 300) : String(err)}\`\`\``,
    color: 0xFF0000,
    footer: `Lab Agent v${AGENT_VERSION}`,
  }).catch(() => {})
  process.exit(1)
})
