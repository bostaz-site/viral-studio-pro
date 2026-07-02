import { getSystemPrompt, buildBatchPrompt, estimateTokens } from './prompt-builder'
import type { LeadContext } from './prompt-builder'
import { calculateCost, logAiScoringCall } from './cost-tracker'

const MODEL = 'claude-haiku-4-5-20251001'

/** Raw response from Claude for a single lead */
interface ClaudeLeadResult {
  handle: string
  fit_score: number
  activation_score: number
  partner_intent_score: number
  risk_score: number
  confidence: number
  activation_reason: string
  main_concern: string
  recommended_offer_angle: string
  specific_compliment: string
  priority: 'high_priority' | 'medium_priority' | 'low_priority' | 'skip'
}

/** Scored lead with computed final score + backward-compatible fields */
export interface ScoredLead {
  handle: string
  // V2 sub-scores
  fit_score: number
  activation_score: number
  partner_intent_score: number
  risk_score: number
  confidence: number
  activation_reason: string
  main_concern: string
  recommended_offer_angle: string
  specific_compliment: string
  priority: 'high_priority' | 'medium_priority' | 'low_priority' | 'skip'
  // Computed final score
  final_score: number
  // Backward-compatible fields for influencers table
  ai_score: number
  recommendation: 'high_priority' | 'medium_priority' | 'low_priority' | 'skip'
}

/**
 * Compute the final composite score.
 * Formula: activation*0.30 + fit*0.25 + partner_intent*0.20 + contactability*0.15 - risk*0.25
 * Contactability is deterministic (from scraper data), passed in separately.
 */
export function computeFinalScore(
  activationScore: number,
  fitScore: number,
  partnerIntentScore: number,
  contactabilityScore: number,
  riskScore: number,
): number {
  const raw = activationScore * 0.30
    + fitScore * 0.25
    + partnerIntentScore * 0.20
    + contactabilityScore * 0.15
    - riskScore * 0.25
  return Math.max(0, Math.min(100, Math.round(raw)))
}

/**
 * Map final score to recommendation tier (backward-compatible thresholds).
 */
export function scoreToRecommendation(score: number): 'high_priority' | 'medium_priority' | 'low_priority' | 'skip' {
  if (score >= 75) return 'high_priority'
  if (score >= 50) return 'medium_priority'
  if (score >= 25) return 'low_priority'
  return 'skip'
}

/**
 * Score a batch of leads via Claude Haiku. Max 10 per call.
 * Returns scored results + cost info.
 */
export async function scoreBatchWithClaude(
  leads: LeadContext[],
  contactabilityScores: Map<string, number>,
  jobId: string,
): Promise<{ results: ScoredLead[]; costUsd: number; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const systemPrompt = getSystemPrompt()
  const userPrompt = buildBatchPrompt(leads)

  const start = Date.now()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(30000),
  })

  const latencyMs = Date.now() - start

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    await logAiScoringCall({
      feature: 'batch_scoring',
      model: MODEL,
      inputTokens: estimateTokens(systemPrompt + userPrompt),
      outputTokens: 0,
      costUsd: 0,
      latencyMs,
      success: false,
      error: `${res.status}: ${errText}`,
      contextId: jobId,
      contextType: 'ai_scoring_job',
    })
    throw new Error(`Claude API error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? '{}'
  const inputTokens = data.usage?.input_tokens ?? estimateTokens(systemPrompt + userPrompt)
  const outputTokens = data.usage?.output_tokens ?? estimateTokens(text)
  const costUsd = calculateCost(inputTokens, outputTokens)

  // Parse response
  let rawResults: ClaudeLeadResult[] = []
  try {
    const parsed = JSON.parse(text)
    rawResults = parsed.results ?? []
  } catch {
    await logAiScoringCall({
      feature: 'batch_scoring',
      model: MODEL,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs,
      success: false,
      error: 'Failed to parse JSON response',
      contextId: jobId,
      contextType: 'ai_scoring_job',
    })
    throw new Error('Failed to parse Claude response as JSON')
  }

  // Compute final scores with contactability
  const results: ScoredLead[] = rawResults.map(r => {
    const contactability = contactabilityScores.get(r.handle.toLowerCase()) ?? 30
    const finalScore = computeFinalScore(
      r.activation_score,
      r.fit_score,
      r.partner_intent_score,
      contactability,
      r.risk_score,
    )
    const recommendation = scoreToRecommendation(finalScore)

    return {
      ...r,
      final_score: finalScore,
      ai_score: finalScore,
      recommendation,
    }
  })

  // Log successful call
  await logAiScoringCall({
    feature: 'batch_scoring',
    model: MODEL,
    inputTokens,
    outputTokens,
    costUsd,
    latencyMs,
    success: true,
    contextId: jobId,
    contextType: 'ai_scoring_job',
  })

  return { results, costUsd, inputTokens, outputTokens }
}
