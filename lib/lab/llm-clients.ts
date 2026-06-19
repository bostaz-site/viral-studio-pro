/**
 * Multi-LLM client wrappers for The Lab council.
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractClaudeText } from '../audit/safe-json'

interface LlmResponse {
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
  // Sonnet 4: $3/MTok input, $15/MTok output
  const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000

  return {
    text,
    cost_usd: cost,
    duration_ms: Date.now() - start,
    model: 'claude-sonnet-4-6',
  }
}

export async function askGPT(prompt: string): Promise<LlmResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[lab] OPENAI_API_KEY not set, returning fallback')
    return { text: '{"solution":"OpenAI API key not configured","rationale":"N/A","concerns":"Cannot provide analysis without API key","effort_estimate_hours":0,"confidence":1}', cost_usd: 0, duration_ms: 0, model: 'gpt-4o-fallback' }
  }

  const client = new OpenAI({ apiKey })
  const start = Date.now()

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0
  // GPT-4o: $2.50/MTok input, $10/MTok output
  const cost = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000

  return {
    text,
    cost_usd: cost,
    duration_ms: Date.now() - start,
    model: response.model,
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
  // Gemini 2.5 Pro: ~$1.25/MTok input, ~$10/MTok output (approx)
  const cost = 0.02 // rough estimate per call

  return {
    text,
    cost_usd: cost,
    duration_ms: Date.now() - start,
    model: 'gemini-2.5-pro',
  }
}
