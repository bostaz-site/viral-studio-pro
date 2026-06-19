/**
 * Quick test for Claude Code CLI subprocess integration.
 * Run: npx tsx scripts/lab/test-claude-cli.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

// Force CLI mode for this test
process.env.LAB_USE_CLAUDE_CLI = 'true'
process.env.LAB_FORCE_GEMINI = 'false'

import { askClaude, askClaudeOpus } from '../../lib/lab/llm-clients'

async function test() {
  console.log('=== Claude Code CLI Subprocess Test ===\n')

  console.log('1. Testing Sonnet via CLI...')
  const sonnet = await askClaude('Say exactly: "Hello from Sonnet" — nothing else.')
  console.log('   Response:', sonnet.text.slice(0, 100))
  console.log('   Model:', sonnet.model)
  console.log('   Cost: $' + sonnet.cost_usd)
  console.log('   Duration:', sonnet.duration_ms, 'ms')

  console.log('\n2. Testing Opus via CLI...')
  const opus = await askClaudeOpus('Say exactly: "Hello from Opus" — nothing else.')
  console.log('   Response:', opus.text.slice(0, 100))
  console.log('   Model:', opus.model)
  console.log('   Cost: $' + opus.cost_usd)
  console.log('   Duration:', opus.duration_ms, 'ms')

  console.log('\n=== All tests passed! CLI subprocess works. ===')
}

test().catch((err) => {
  console.error('Test FAILED:', err)
  process.exit(1)
})
