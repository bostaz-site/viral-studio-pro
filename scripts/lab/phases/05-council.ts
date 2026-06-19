/**
 * Phase 3 — Multi-LLM Council (~10 min)
 *
 * V3: Sonnet + Opus + Gemini (free) + optional GPT
 * - Claude Sonnet 4.6 (structured reasoning)
 * - Claude Opus 4.6 (deep reasoning)
 * - Gemini 2.5 Pro (pattern breadth, free tier)
 * - GPT-4o (optional, only if LAB_INCLUDE_GPT=true)
 */

import { askClaude, askClaudeOpus, askGemini, askGPT } from '../../../lib/lab/llm-clients'
import { safeParseClaudeJson } from '../../../lib/audit/safe-json'
import { createAdminClient } from '../../../lib/supabase/admin'
import { updateDive } from '../queue'
import type { CouncilResponse } from '../../../lib/lab/types'

function buildCouncilBrief(dive: {
  feature_area: string
  context_founder_goals: string | null
  context_main_doc: string | null
  research_synthesis: string | null
  target_metric: string
  target_delta_minimum: number | null
}): string {
  const docContext = dive.context_main_doc
    ? `\nFEATURE DOCUMENTATION:\n${dive.context_main_doc.slice(0, 4000)}\n`
    : ''

  return `You are advising on a product decision for Viral Animal, a SaaS that helps streamers go viral with clip editing tools.

FEATURE AREA: ${dive.feature_area}
${docContext}
FOUNDER CONTEXT:
${dive.context_founder_goals || 'No specific founder context.'}

RESEARCH SYNTHESIS:
${(dive.research_synthesis || 'No research available.').slice(0, 3000)}

TARGET METRIC: ${dive.target_metric}
Minimum delta to justify shipping: ${dive.target_delta_minimum ?? 'TBD'}

YOUR TASK:
Propose THE single best solution to move ${dive.target_metric} by at least the target delta.

Be specific and actionable — not vague platitudes. Think like a senior PM at a growth-stage SaaS.

OUTPUT FORMAT (strict JSON):
{
  "solution": "1-2 paragraphs of your specific recommendation",
  "rationale": "why this and not alternatives (2-3 sentences)",
  "concerns": "what could go wrong or what assumptions might be wrong (2-3 sentences)",
  "effort_estimate_hours": <number>,
  "confidence": <1-10>
}`
}

const FALLBACK_RESPONSE: CouncilResponse = {
  solution: 'Unable to generate response',
  rationale: 'API call failed',
  concerns: 'N/A',
  effort_estimate_hours: 0,
  confidence: 1,
}

export async function runMultiLlmCouncil(
  diveId: string,
  dive: {
    feature_area: string
    context_founder_goals: string | null
    context_main_doc: string | null
    research_synthesis: string | null
    target_metric: string
    target_delta_minimum: number | null
  }
): Promise<{ cost: number }> {
  console.log('[lab:council] Starting multi-LLM council (Sonnet + Opus + Gemini)...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const brief = buildCouncilBrief(dive)

  // Run Sonnet + Opus + Gemini in parallel, optional GPT
  const [sonnetResp, opusResp, geminiResp, gptResp] = await Promise.all([
    askClaude(brief, 4096).catch(err => {
      console.error('[lab:council] Sonnet failed:', err)
      return { text: JSON.stringify(FALLBACK_RESPONSE), cost_usd: 0, duration_ms: 0, model: 'claude-sonnet-4-6' }
    }),
    askClaudeOpus(brief, 4096).catch(err => {
      console.error('[lab:council] Opus failed:', err)
      return { text: JSON.stringify(FALLBACK_RESPONSE), cost_usd: 0, duration_ms: 0, model: 'claude-opus-4-6' }
    }),
    askGemini(brief).catch(err => {
      console.error('[lab:council] Gemini failed:', err)
      return { text: JSON.stringify(FALLBACK_RESPONSE), cost_usd: 0, duration_ms: 0, model: 'gemini-2.5-pro' }
    }),
    askGPT(brief).catch(err => {
      console.error('[lab:council] GPT failed:', err)
      return null
    }),
  ])

  const sonnetParsed = safeParseClaudeJson<CouncilResponse>(sonnetResp.text, FALLBACK_RESPONSE)
  const opusParsed = safeParseClaudeJson<CouncilResponse>(opusResp.text, FALLBACK_RESPONSE)
  const geminiParsed = safeParseClaudeJson<CouncilResponse>(geminiResp.text, FALLBACK_RESPONSE)

  // Store responses
  const inserts = [
    admin.from('lab_council_responses').insert({
      deep_dive_id: diveId,
      llm_provider: 'claude_sonnet',
      llm_model: sonnetResp.model,
      response_solution: sonnetParsed.solution,
      response_rationale: sonnetParsed.rationale,
      response_concerns: sonnetParsed.concerns,
      response_raw: sonnetParsed,
      cost_usd: sonnetResp.cost_usd,
      duration_ms: sonnetResp.duration_ms,
    }),
    admin.from('lab_council_responses').insert({
      deep_dive_id: diveId,
      llm_provider: 'claude_opus',
      llm_model: opusResp.model,
      response_solution: opusParsed.solution,
      response_rationale: opusParsed.rationale,
      response_concerns: opusParsed.concerns,
      response_raw: opusParsed,
      cost_usd: opusResp.cost_usd,
      duration_ms: opusResp.duration_ms,
    }),
    admin.from('lab_council_responses').insert({
      deep_dive_id: diveId,
      llm_provider: 'gemini',
      llm_model: geminiResp.model,
      response_solution: geminiParsed.solution,
      response_rationale: geminiParsed.rationale,
      response_concerns: geminiParsed.concerns,
      response_raw: geminiParsed,
      cost_usd: geminiResp.cost_usd,
      duration_ms: geminiResp.duration_ms,
    }),
  ]

  // Optional GPT
  if (gptResp) {
    const gptParsed = safeParseClaudeJson<CouncilResponse>(gptResp.text, FALLBACK_RESPONSE)
    inserts.push(
      admin.from('lab_council_responses').insert({
        deep_dive_id: diveId,
        llm_provider: 'openai',
        llm_model: gptResp.model,
        response_solution: gptParsed.solution,
        response_rationale: gptParsed.rationale,
        response_concerns: gptParsed.concerns,
        response_raw: gptParsed,
        cost_usd: gptResp.cost_usd,
        duration_ms: gptResp.duration_ms,
      })
    )
  }

  await Promise.all(inserts)

  await updateDive(diveId, {
    council_completed_at: new Date().toISOString(),
  })

  const totalCost = sonnetResp.cost_usd + opusResp.cost_usd + geminiResp.cost_usd + (gptResp?.cost_usd ?? 0)
  const providers = ['Sonnet', 'Opus', 'Gemini', ...(gptResp ? ['GPT'] : [])]
  console.log(`[lab:council] Done. ${providers.join(' + ')}. Cost: $${totalCost.toFixed(4)}`)
  return { cost: totalCost }
}
