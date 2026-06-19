/**
 * Lab LLM Clients — V3 with Claude Code CLI subprocess
 *
 * Fallback chain: Claude CLI (Max subscription, $0) → Anthropic API → Gemini (free tier)
 *
 * - askClaude() : Sonnet via CLI subprocess (uses Samy's Max subscription)
 * - askClaudeOpus() : Opus via CLI subprocess
 * - askGemini() : Google AI Studio free tier (1500 req/day)
 * - askGPT() : disabled by default (needs LAB_INCLUDE_GPT=true + OPENAI_API_KEY)
 *
 * Env vars:
 * - LAB_USE_CLAUDE_CLI=true (default) — use CLI subprocess
 * - LAB_FORCE_GEMINI=true — bypass Claude entirely, use Gemini for all
 */

import { spawn } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractClaudeText } from '../audit/safe-json'

export interface LlmResponse {
  text: string
  cost_usd: number
  duration_ms: number
  model: string
}

function isAnthropicCreditError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? ''
  return msg.toLowerCase().includes('credit balance') || msg.toLowerCase().includes('insufficient')
}

/**
 * Call Claude Code CLI as subprocess.
 * Uses Samy's Max subscription — $0 cost.
 *
 * Writes prompt to a temp file, then passes it via stdin pipe
 * to avoid shell escaping issues with long/multi-line prompts.
 */
async function askClaudeViaCli(
  prompt: string,
  model: 'claude-sonnet-4-6' | 'claude-opus-4-6',
): Promise<LlmResponse> {
  const start = Date.now()

  const text = await new Promise<string>((resolve, reject) => {
    // Strip ANTHROPIC_API_KEY so CLI uses Max subscription instead of paid API
    const env = { ...process.env }
    delete env.ANTHROPIC_API_KEY

    const child = spawn('claude', [
      '-p',
      '--model', model,
      '--output-format', 'text',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5 * 60 * 1000, // 5 min timeout
      env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    child.on('error', (err) => reject(new Error(`claude CLI spawn error: ${err.message}`)))
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`))
      } else {
        resolve(stdout.trim())
      }
    })

    // Write prompt to stdin and close it
    child.stdin.write(prompt)
    child.stdin.end()
  })

  return {
    text,
    cost_usd: 0,
    duration_ms: Date.now() - start,
    model: `${model}-via-cli`,
  }
}

async function askClaudeViaApi(
  prompt: string,
  model: 'claude-sonnet-4-6' | 'claude-opus-4-6',
  maxTokens: number,
): Promise<LlmResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[lab] No ANTHROPIC_API_KEY for API fallback, using Gemini')
    return askGemini(prompt)
  }

  const client = new Anthropic({ apiKey })
  const start = Date.now()

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractClaudeText(response)
  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0

  const costPerMInput = model === 'claude-opus-4-6' ? 15 : 3
  const costPerMOutput = model === 'claude-opus-4-6' ? 75 : 15
  const cost = (inputTokens * costPerMInput + outputTokens * costPerMOutput) / 1_000_000

  return { text, cost_usd: cost, duration_ms: Date.now() - start, model }
}

export async function askClaude(prompt: string, maxTokens = 4096): Promise<LlmResponse> {
  if (process.env.LAB_FORCE_GEMINI === 'true') {
    return askGemini(prompt)
  }

  // Prefer CLI subprocess (Max subscription, free)
  if (process.env.LAB_USE_CLAUDE_CLI !== 'false') {
    try {
      return await askClaudeViaCli(prompt, 'claude-sonnet-4-6')
    } catch (err) {
      console.warn('[lab] Claude CLI failed, falling back to API:', (err as Error).message)
    }
  }

  // Fallback to API
  try {
    return await askClaudeViaApi(prompt, 'claude-sonnet-4-6', maxTokens)
  } catch (err) {
    if (isAnthropicCreditError(err)) {
      console.warn('[lab] Anthropic credit balance too low, falling back to Gemini')
      return askGemini(prompt)
    }
    throw err
  }
}

export async function askClaudeOpus(prompt: string, maxTokens = 4096): Promise<LlmResponse> {
  if (process.env.LAB_FORCE_GEMINI === 'true') {
    return askGemini(prompt + '\n\n[Persona: Senior product strategist — think creatively, see the bigger picture]')
  }

  if (process.env.LAB_USE_CLAUDE_CLI !== 'false') {
    try {
      return await askClaudeViaCli(prompt, 'claude-opus-4-6')
    } catch (err) {
      console.warn('[lab] Claude Opus CLI failed, falling back to API:', (err as Error).message)
    }
  }

  try {
    return await askClaudeViaApi(prompt, 'claude-opus-4-6', maxTokens)
  } catch (err) {
    if (isAnthropicCreditError(err)) {
      console.warn('[lab] Anthropic credit balance too low, falling back to Gemini')
      return askGemini(prompt + '\n\n[Persona: Senior product strategist — think creatively, see the bigger picture]')
    }
    throw err
  }
}

export async function askGemini(prompt: string): Promise<LlmResponse> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[lab] GOOGLE_GEMINI_API_KEY not set, returning fallback')
    return { text: '{"solution":"Gemini API key not configured","rationale":"N/A","concerns":"Cannot provide analysis without API key","effort_estimate_hours":0,"confidence":1}', cost_usd: 0, duration_ms: 0, model: 'gemini-2.5-pro-fallback' }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-06-05' })
  const start = Date.now()

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  return { text, cost_usd: 0, duration_ms: Date.now() - start, model: 'gemini-2.5-pro' }
}

export async function askGPT(prompt: string): Promise<LlmResponse | null> {
  if (process.env.LAB_INCLUDE_GPT !== 'true' || !process.env.OPENAI_API_KEY) {
    return null
  }

  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const start = Date.now()

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0
  const cost = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000

  return { text, cost_usd: cost, duration_ms: Date.now() - start, model: response.model }
}
