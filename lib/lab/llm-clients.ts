/**
 * Lab LLM Clients — V3 Free Setup
 *
 * - askClaude() : Anthropic API (ANTHROPIC_API_KEY)
 * - askClaudeOpus() : Anthropic API with Opus model
 * - askGemini() : Google AI Studio free tier (1500 req/day)
 * - askGPT() : disabled by default (needs LAB_INCLUDE_GPT=true + OPENAI_API_KEY)
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractClaudeText } from '../audit/safe-json'

export interface LlmResponse {
  text: string
  cost_usd: number
  duration_ms: number
  model: string
}

export async function askClaude(prompt: string, maxTokens = 4096): Promise<LlmResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })
  const start = Date.now()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractClaudeText(response)
  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000

  return { text, cost_usd: cost, duration_ms: Date.now() - start, model: 'claude-sonnet-4-6' }
}

export async function askClaudeOpus(prompt: string, maxTokens = 4096): Promise<LlmResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })
  const start = Date.now()

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractClaudeText(response)
  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  const cost = (inputTokens * 15 + outputTokens * 75) / 1_000_000

  return { text, cost_usd: cost, duration_ms: Date.now() - start, model: 'claude-opus-4-6' }
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
