import { getSystemPrompt, buildBatchPrompt, estimateTokens } from './prompt-builder'
import { calculateCost, logAiScoringCall } from './cost-tracker'

const MODEL = 'claude-haiku-4-5-20251001'

interface ScoredLead {
  handle: string
  ai_score: number
  recommendation: 'high_priority' | 'medium_priority' | 'low_priority' | 'skip'
  confidence: number
  strengths: string[]
  concerns: string[]
  reasoning: string
}

interface LeadInput {
  handle: string
  displayName: string | null
  bio: string | null
  followers: number
  engagement: number | null
  recentPostTitles: string[]
  promotedProducts: string[]
  links: string[]
  keywordScore: number
  strongSignals: string[]
}

/**
 * Score a batch of leads via Claude Haiku. Max 10 per call.
 * Returns scored results + cost info.
 */
export async function scoreBatchWithClaude(
  leads: LeadInput[],
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
      max_tokens: 2000,
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
  let results: ScoredLead[] = []
  try {
    const parsed = JSON.parse(text)
    results = parsed.results ?? []
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
