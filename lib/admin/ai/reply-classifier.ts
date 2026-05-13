/**
 * Reply Classifier — Claude Haiku classifies inbound email sentiment + intent.
 * Updates email_messages with ai_sentiment, ai_intent, ai_confidence, ai_classified_at.
 */

import { CLASSIFY_REPLY_PROMPT, fillPrompt } from './prompts'
import { logAdminAiCall } from './log-call'

const MODEL = 'claude-haiku-4-5-20251001'

const VALID_SENTIMENTS = ['positive', 'neutral_question', 'negative', 'spam', 'hostile'] as const
type Sentiment = typeof VALID_SENTIMENTS[number]

const VALID_ACTIONS = ['send_drafts', 'manual_response', 'schedule_followup', 'archive', 'block'] as const

export interface ClassificationResult {
  sentiment: Sentiment
  confidence: number
  intent: string
  key_phrases: string[]
  suggested_action: string
  reasoning: string
}

export async function classifyReply(params: {
  messageId: string
  body: string
  influencerName: string
  platform: string
  niche: string
  audienceSize: number | null
}): Promise<ClassificationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = fillPrompt(CLASSIFY_REPLY_PROMPT, {
    body: params.body.slice(0, 3000),
    name: params.influencerName,
    platform: params.platform,
    niche: params.niche,
    audience_size: params.audienceSize ?? 0,
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

    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0

    logAdminAiCall({
      feature: 'reply_classification',
      contextId: params.messageId,
      contextType: 'email_message',
      inputTokens,
      outputTokens,
      latencyMs,
      success: res.ok,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    })

    if (!res.ok) return null

    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) return null

    return parseClassification(textBlock.text)
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logAdminAiCall({
      feature: 'reply_classification',
      contextId: params.messageId,
      contextType: 'email_message',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function parseClassification(text: string): ClassificationResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    const sentiment: Sentiment = VALID_SENTIMENTS.includes(parsed.sentiment)
      ? parsed.sentiment
      : 'neutral_question'

    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5

    return {
      sentiment,
      confidence,
      intent: typeof parsed.intent === 'string' ? parsed.intent : 'other',
      key_phrases: Array.isArray(parsed.key_phrases)
        ? parsed.key_phrases.filter((p: unknown) => typeof p === 'string').slice(0, 5)
        : [],
      suggested_action: VALID_ACTIONS.includes(parsed.suggested_action)
        ? parsed.suggested_action
        : 'manual_response',
      reasoning: typeof parsed.reasoning === 'string'
        ? parsed.reasoning.slice(0, 300)
        : '',
    }
  } catch {
    return null
  }
}
