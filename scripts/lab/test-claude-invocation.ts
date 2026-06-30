/**
 * Diagnostic: test different methods of spawning claude CLI on Windows.
 * Run: npx tsx scripts/lab/test-claude-invocation.ts
 */
import { spawn, execSync } from 'child_process'

const PROMPT = 'Say hello in exactly 3 words. Output ONLY the 3 words, nothing else.'
const REPO = process.cwd()
const TIMEOUT_MS = 120_000

const CLAUDE_EXE = String(execSync('where claude', { encoding: 'utf-8' })).trim().split('\n')[0].trim()

async function testMethod(name: string, runFn: () => Promise<string>): Promise<boolean> {
  console.log(`\n=== ${name} ===`)
  const start = Date.now()
  try {
    const output = await runFn()
    const duration = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  PASS in ${duration}s — Output: ${output.trim().slice(0, 200)}`)
    return true
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  FAIL after ${duration}s: ${(err as Error).message.slice(0, 200)}`)
    return false
  }
}

function spawnPromise(cmd: string, args: string[], useShell: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: REPO,
      shell: useShell,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    child.stdout.on('data', (c: Buffer) => (out += c.toString()))
    child.stderr.on('data', (c: Buffer) => (out += c.toString()))
    child.on('close', (code: number | null) =>
      code === 0 ? resolve(out) : reject(new Error(`exit ${code}: ${out.slice(0, 300)}`)))
    child.on('error', reject)
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, TIMEOUT_MS)
    child.on('close', () => clearTimeout(timer))
  })
}

const ARGS = ['-p', PROMPT, '--model', 'claude-sonnet-4-6', '--max-turns', '3', '--output-format', 'text', '--dangerously-skip-permissions']

async function main() {
  console.log(`Claude exe: ${CLAUDE_EXE}`)
  const results: Record<string, boolean> = {}

  results['full-path shell:false'] = await testMethod(
    'Full exe path, shell:false (recommended)',
    () => spawnPromise(CLAUDE_EXE, ARGS, false),
  )

  results['claude shell:true'] = await testMethod(
    'claude, shell:true',
    () => spawnPromise('claude', ARGS, true),
  )

  console.log('\n=== Summary ===')
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v ? 'PASS' : 'FAIL'}  ${k}`)
  }
}

main().catch(console.error)
