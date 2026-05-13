/**
 * Lead Scorer — rule-based (5 factors) + Claude Haiku reasoning (1 factor).
 *
 * Score 0-100:
 *   25% niche_fit
 *   20% audience_size (log scale)
 *   15% engagement_rate (placeholder, uses audience proxy)
 *   15% sponsorship_likelihood (Claude reasoning)
 *   15% reply_sentiment_history
 *   10% geo_lang_fit
 */

import { LEAD_SCORE_PROMPT, fillPrompt } from './prompts'
import { logAdminAiCall } from './log-call'
import { createAdminClient } from '@/lib/supabase/admin'

const MODEL = 'claude-haiku-4-5-20251001'

export interface LeadScoreResult {
  score: number
  breakdown: {
    niche_fit: number
    audience_size: number
    engagement_rate: number
    sponsorship_likelihood: number
    reply_sentiment: number
    geo_lang_fit: number
  }
  reasons: string[]
}

// --- Rule-based factors ---

const NICHE_SCORES: Record<string, number> = {
  gaming: 100, fps: 95, moba: 90, esports: 90, minecraft: 85,
  irl: 75, just_chatting: 70, variety: 65, entertainment: 60,
  business: 55, tech: 55, finance: 50,
  fitness: 40, cooking: 35, beauty: 30, music: 30,
}

function scoreNicheFit(niche: string | null): number {
  if (!niche) return 50
  const lower = niche.toLowerCase()
  for (const [key, score] of Object.entries(NICHE_SCORES)) {
    if (lower.includes(key)) return score
  }
  return 50
}

function scoreAudienceSize(size: number | null): number {
  if (!size || size <= 0) return 10
  // Log scale: 100=10, 1K=30, 10K=50, 100K=70, 1M=90, 10M=100
  const logVal = Math.log10(size)
  return Math.min(100, Math.max(0, Math.round(logVal * 20)))
}

function scoreEngagementProxy(audienceSize: number | null): number {
  // Placeholder — when enrichment data is available, use actual engagement rate
  // For now, medium audiences (1k-100k) get higher scores (more engaged typically)
  if (!audienceSize) return 40
  if (audienceSize < 500) return 30
  if (audienceSize < 5000) return 70
  if (audienceSize < 50000) return 80
  if (audienceSize < 500000) return 60
  return 40 // Very large audiences tend to have lower engagement
}

function scoreGeoLangFit(country: string | null, language: string | null): number {
  const lang = (language || '').toLowerCase()
  const co = (country || '').toUpperCase()

  if (lang === 'en' && ['US', 'CA', 'UK', 'GB', 'AU'].includes(co)) return 100
  if (lang === 'en') return 85
  if (lang === 'fr' && ['CA', 'FR', 'BE'].includes(co)) return 90
  if (lang === 'fr') return 75
  if (lang === 'es' || lang === 'pt' || lang === 'de') return 60
  return 50
}

async function scoreSentimentHistory(
  admin: ReturnType<typeof createAdminClient>,
  influencerId: string
): Promise<number> {
  const { data: messages } = await admin
    .from('email_messages')
    .select('ai_sentiment')
    .eq('influencer_id', influencerId)
    .eq('direction', 'inbound')
    .not('ai_sentiment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!messages || messages.length === 0) return 50

  const sentimentScores: Record<string, number> = {
    positive: 100,
    neutral_question: 65,
    neutral: 50,
    negative: 20,
    spam: 5,
    hostile: 0,
  }

  const total = messages.reduce((sum, m) => {
    return sum + (sentimentScores[m.ai_sentiment ?? ''] ?? 50)
  }, 0)

  return Math.round(total / messages.length)
}

// --- Claude factor ---

async function scoreSponsorshipLikelihood(params: {
  influencerId: string
  name: string
  email: string
  platform: string
  handle: string
  niche: string
  audienceSize: number | null
  country: string | null
  language: string | null
  status: string
  sentimentHistory: string
  emailsSent: number
  emailsReplied: number
}): Promise<{ score: number; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { score: 50, reasoning: 'No API key — using default' }

  const prompt = fillPrompt(LEAD_SCORE_PROMPT, {
    name: params.name,
    email: params.email,
    platform: params.platform,
    handle: params.handle,
    niche: params.niche,
    audience_size: params.audienceSize ?? 0,
    country: params.country ?? 'unknown',
    language: params.language ?? 'unknown',
    status: params.status,
    sentiment_history: params.sentimentHistory || 'none',
    emails_sent: params.emailsSent,
    emails_replied: params.emailsReplied,
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
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const latencyMs = Date.now() - startMs
    const data = await res.json()

    logAdminAiCall({
      feature: 'lead_scoring',
      contextId: params.influencerId,
      contextType: 'influencer',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      latencyMs,
      success: res.ok,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    })

    if (!res.ok) return { score: 50, reasoning: 'API error' }

    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const jsonMatch = textBlock?.text?.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { score: 50, reasoning: 'Parse error' }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.sponsorship_score ?? 50))),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 300) : '',
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logAdminAiCall({
      feature: 'lead_scoring',
      contextId: params.influencerId,
      contextType: 'influencer',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
    return { score: 50, reasoning: 'API unavailable' }
  }
}

// --- Main scoring function ---

export async function computeLeadScore(influencer: {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  primary_platform: string | null
  platform_handle: string | null
  niche: string | null
  audience_size: number | null
  country: string | null
  language: string | null
  status: string
  total_emails_sent: number
  total_emails_replied: number
}): Promise<LeadScoreResult> {
  const admin = createAdminClient()

  const name = influencer.display_name || influencer.first_name || influencer.email.split('@')[0]

  // Parallel: sentiment history + Claude sponsorship
  const sentimentHistoryScore = await scoreSentimentHistory(admin, influencer.id)

  const sentimentHistoryText = sentimentHistoryScore > 70 ? 'mostly positive' :
    sentimentHistoryScore > 40 ? 'mixed' : sentimentHistoryScore > 0 ? 'mostly negative' : 'none'

  const sponsorship = await scoreSponsorshipLikelihood({
    influencerId: influencer.id,
    name,
    email: influencer.email,
    platform: influencer.primary_platform || 'unknown',
    handle: influencer.platform_handle || '',
    niche: influencer.niche || '',
    audienceSize: influencer.audience_size,
    country: influencer.country,
    language: influencer.language,
    status: influencer.status,
    sentimentHistory: sentimentHistoryText,
    emailsSent: influencer.total_emails_sent || 0,
    emailsReplied: influencer.total_emails_replied || 0,
  })

  const breakdown = {
    niche_fit: scoreNicheFit(influencer.niche),
    audience_size: scoreAudienceSize(influencer.audience_size),
    engagement_rate: scoreEngagementProxy(influencer.audience_size),
    sponsorship_likelihood: sponsorship.score,
    reply_sentiment: sentimentHistoryScore,
    geo_lang_fit: scoreGeoLangFit(influencer.country, influencer.language),
  }

  const score = Math.round(
    breakdown.niche_fit * 0.25 +
    breakdown.audience_size * 0.20 +
    breakdown.engagement_rate * 0.15 +
    breakdown.sponsorship_likelihood * 0.15 +
    breakdown.reply_sentiment * 0.15 +
    breakdown.geo_lang_fit * 0.10
  )

  const reasons: string[] = []
  if (breakdown.niche_fit >= 80) reasons.push(`Strong niche fit (${influencer.niche})`)
  if (breakdown.audience_size >= 60) reasons.push(`Solid audience (${influencer.audience_size?.toLocaleString()})`)
  if (breakdown.reply_sentiment >= 70) reasons.push('Positive reply history')
  if (sponsorship.reasoning) reasons.push(sponsorship.reasoning)

  return { score: Math.max(0, Math.min(100, score)), breakdown, reasons }
}
