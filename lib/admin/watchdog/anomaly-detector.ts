import type { SupabaseClient } from '@supabase/supabase-js'
import { logAiCall } from '@/lib/ai/call-logger'
import type { AlertCandidate } from './checks'

const MODEL = 'claude-haiku-4-5-20251001'

interface WeeklyMetrics {
  sentThisWeek: number
  sentLastWeek: number
  repliesThisWeek: number
  repliesLastWeek: number
  bouncesThisWeek: number
  bouncesLastWeek: number
  newInfluencersThisWeek: number
  newInfluencersLastWeek: number
  suppressionsThisWeek: number
  suppressionsLastWeek: number
}

/**
 * Collect weekly metrics for anomaly detection.
 */
async function collectMetrics(admin: SupabaseClient): Promise<WeeklyMetrics> {
  const now = Date.now()
  const thisWeekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const lastWeekStart = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  async function countEvents(type: string, from: string, to?: string) {
    let q = admin
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', type)
      .gte('occurred_at', from)
    if (to) q = q.lt('occurred_at', to)
    const { count } = await q
    return count || 0
  }

  async function countTable(table: string, from: string, to?: string) {
    let q = admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .gte('created_at', from)
    if (to) q = q.lt('created_at', to)
    const { count } = await q
    return count || 0
  }

  const [
    sentThisWeek, sentLastWeek,
    repliesThisWeek, repliesLastWeek,
    bouncesThisWeek, bouncesLastWeek,
    newInfluencersThisWeek, newInfluencersLastWeek,
    suppressionsThisWeek, suppressionsLastWeek,
  ] = await Promise.all([
    countEvents('sent', thisWeekStart),
    countEvents('sent', lastWeekStart, thisWeekStart),
    countEvents('replied', thisWeekStart),
    countEvents('replied', lastWeekStart, thisWeekStart),
    countEvents('bounced_hard', thisWeekStart),
    countEvents('bounced_hard', lastWeekStart, thisWeekStart),
    countTable('influencers', thisWeekStart),
    countTable('influencers', lastWeekStart, thisWeekStart),
    countTable('suppression_list', thisWeekStart),
    countTable('suppression_list', lastWeekStart, thisWeekStart),
  ])

  return {
    sentThisWeek, sentLastWeek,
    repliesThisWeek, repliesLastWeek,
    bouncesThisWeek, bouncesLastWeek,
    newInfluencersThisWeek, newInfluencersLastWeek,
    suppressionsThisWeek, suppressionsLastWeek,
  }
}

/**
 * Use Claude Haiku to detect anomalies in weekly metrics.
 * Returns an AlertCandidate if anomaly found, null otherwise.
 */
export async function detectAnomalies(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const metrics = await collectMetrics(admin)

  // Skip if there's not enough data
  if (metrics.sentThisWeek + metrics.sentLastWeek < 10) return null

  const prompt = `Here are the email outreach metrics for this week vs last week:

Emails sent: ${metrics.sentThisWeek} (this week) vs ${metrics.sentLastWeek} (last week)
Replies: ${metrics.repliesThisWeek} vs ${metrics.repliesLastWeek}
Bounces: ${metrics.bouncesThisWeek} vs ${metrics.bouncesLastWeek}
New leads imported: ${metrics.newInfluencersThisWeek} vs ${metrics.newInfluencersLastWeek}
Suppressions (bounces+unsubs): ${metrics.suppressionsThisWeek} vs ${metrics.suppressionsLastWeek}

Is there a notable anomaly? If yes, what action should be taken?
Reply ONLY with valid JSON: {"hasAnomaly": bool, "severity": "critical"|"important"|"info", "title": "string max 80 chars", "description": "string max 200 chars"}`

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
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const latencyMs = Date.now() - startMs
    const body = await res.json()

    const textBlock = body.content?.find((b: { type: string }) => b.type === 'text')
    const text = textBlock?.text || ''

    // Log AI call
    logAiCall({
      model: MODEL,
      feature: 'watchdog_anomaly_detection',
      tokensInput: body.usage?.input_tokens,
      tokensOutput: body.usage?.output_tokens,
      latencyMs,
      success: res.ok,
      error: res.ok ? undefined : text,
    })

    if (!res.ok) return null

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.hasAnomaly) return null

    return {
      severity: parsed.severity || 'info',
      category: 'ai_insight',
      title: parsed.title || 'Weekly anomaly detected',
      description: parsed.description || 'Claude detected an unusual pattern in this week\'s metrics.',
      metadata: { metrics, ai_response: parsed },
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logAiCall({
      model: MODEL,
      feature: 'watchdog_anomaly_detection',
      latencyMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
    console.error('[watchdog/anomaly] Claude call failed:', err)
    return null
  }
}
