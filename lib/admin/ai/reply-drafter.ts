/**
 * Reply Drafter — generates 3 reply variants via Claude Haiku.
 * Always human-in-the-loop: drafts are suggestions, never auto-sent.
 */

import { DRAFT_REPLIES_PROMPT, fillPrompt } from './prompts'
import { logAdminAiCall } from './log-call'

const MODEL = 'claude-haiku-4-5-20251001'

export interface DraftReply {
  style: string
  label: string
  subject: string
  body: string
}

export interface DraftResult {
  drafts: DraftReply[]
}

export async function generateReplyDrafts(params: {
  messageId: string
  replyBody: string
  influencerName: string
  platform: string
  niche: string
  audienceSize: number | null
  sentiment: string
}): Promise<DraftResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = fillPrompt(DRAFT_REPLIES_PROMPT, {
    reply_body: params.replyBody.slice(0, 3000),
    name: params.influencerName,
    platform: params.platform,
    niche: params.niche,
    audience_size: params.audienceSize ?? 0,
    sentiment: params.sentiment,
  })

  const startMs = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const latencyMs = Date.now() - startMs
    const data = await res.json()

    logAdminAiCall({
      feature: 'reply_drafts',
      contextId: params.messageId,
      contextType: 'email_message',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      latencyMs,
      success: res.ok,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    })

    if (!res.ok) return null

    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) return null

    return parseDrafts(textBlock.text)
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logAdminAiCall({
      feature: 'reply_drafts',
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

function parseDrafts(text: string): DraftResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.drafts)) return null

    const drafts: DraftReply[] = parsed.drafts
      .filter((d: Record<string, unknown>) => d.body && d.style)
      .slice(0, 3)
      .map((d: Record<string, unknown>) => ({
        style: String(d.style ?? 'other'),
        label: String(d.label ?? d.style ?? 'Draft'),
        subject: String(d.subject ?? ''),
        body: String(d.body ?? ''),
      }))

    return drafts.length > 0 ? { drafts } : null
  } catch {
    return null
  }
}
