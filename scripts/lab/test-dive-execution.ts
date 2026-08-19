/**
 * Test Lab Agent's claude invocation on a real dive prompt WITHOUT committing.
 *
 * Usage: npx tsx scripts/lab/test-dive-execution.ts [feature-area]
 * Default: distribution-hub
 */
import { spawn, execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as path from 'path'
import * as fs from 'fs/promises'

config({ path: path.resolve(__dirname, '..', '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const REPO_PATH = path.resolve(__dirname, '..', '..')
const featureArea = process.argv[2] || 'distribution-hub'
const CLAUDE_EXE = String(execSync('where claude', { encoding: 'utf-8' })).trim().split('\n')[0].trim()

async function main() {
  console.log(`Testing dive execution for: ${featureArea}`)
  console.log(`Claude: ${CLAUDE_EXE}\n`)

  const { data: dives } = await supabase
    .from('lab_deep_dives')
    .select('id, feature_area, cycle_number, final_recommendation')
    .eq('feature_area', featureArea)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)

  const dive = dives?.[0] ?? null
  if (!dive) { console.error(`No completed dive for ${featureArea}`); process.exit(1) }

  console.log(`Dive: ${dive.id}`)

  // Find prompt file
  const dir = path.join(REPO_PATH, 'docs/lab/prompts')
  const files = await fs.readdir(dir).catch(() => [] as string[])
  const match = files.find((f: string) => f.startsWith(featureArea))
  if (!match) { console.error('No prompt file found'); process.exit(1) }
  const promptPath = `docs/lab/prompts/${match}`
  console.log(`Prompt: ${promptPath}\n`)

  // Read-only test — ask claude to describe what it would change
  const testPrompt = `Read the file "${promptPath}" and describe what code changes you would make to implement the "Final Recommendation". List the files you would modify and a 1-line summary for each. Do NOT actually modify any files.`

  console.log('Running claude (read-only)...\n')
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  const start = Date.now()

  await new Promise<void>((resolve, reject) => {
    const child = spawn(CLAUDE_EXE, [
      '-p', testPrompt,
      '--model', 'claude-sonnet-4-6',
      '--max-turns', '5',
      '--output-format', 'text',
      '--dangerously-skip-permissions',
    ], { cwd: REPO_PATH, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })

    child.stdout.on('data', (c) => process.stdout.write(c))
    child.stderr.on('data', (c) => process.stderr.write(c))
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout 5min')) }, 300_000)
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`exit ${code}`)) })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })

  console.log(`\n\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

main().catch((err) => { console.error('Failed:', err.message); process.exit(1) })
