/**
 * Thread Summarizer — generates a conversation summary for threads > 5 messages.
 */

import { THREAD_SUMMARY_PROMPT, fillPrompt } from './prompts'
import { logAdminAiCall } from './log-call'

const MODEL = 'claude-haiku-4-5-20251001'

export interface ThreadSummaryResult {
  summary: string
  status: string
  key_points: string[]
  next_action: string
}

export async function summarizeThread(params: {
  influencerId: string
  messages: { direction: string; body_text: string | null; sent_at: string | null; created_at: string }[]
}): Promise<ThreadSummaryResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  // Format messages for prompt
  const formattedMessages = params.messages
    .slice(-20) // Last 20 messages max
    .map((m, i) => {
      const sender = m.direction === 'inbound' ? 'Influencer' : 'Viral Animal'
      const date = m.sent_at || m.created_at
      const body = (m.body_text || '(no body)').slice(0, 500)
      return `[${i + 1}] ${sender} (${new Date(date).toLocaleDateString()}): ${body}`
    })
    .join('\n\n')

  const prompt = fillPrompt(THREAD_SUMMARY_PROMPT, {
    messages: formattedMessages,
  })

  const startMs = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const latencyMs = Date.now() - startMs
    const data = await res.json()

    logAdminAiCall({
      feature: 'thread_summary',
      contextId: params.influencerId,
      contextType: 'influencer',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      latencyMs,
      success: res.ok,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    })

    if (!res.ok) return null

    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) return null

    return parseSummary(textBlock.text)
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logAdminAiCall({
      feature: 'thread_summary',
      contextId: params.influencerId,
      contextType: 'influencer',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function parseSummary(text: string): ThreadSummaryResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
      status: typeof parsed.status === 'string' ? parsed.status : 'waiting',
      key_points: Array.isArray(parsed.key_points)
        ? parsed.key_points.filter((p: unknown) => typeof p === 'string').slice(0, 5)
        : [],
      next_action: typeof parsed.next_action === 'string' ? parsed.next_action.slice(0, 300) : '',
    }
  } catch {
    return null
  }
}
