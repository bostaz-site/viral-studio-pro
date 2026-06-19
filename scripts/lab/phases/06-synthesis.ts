/**
 * Phase 4 — Synthesis + Kill Switch (~5 min)
 *
 * V3: Compares Sonnet + Opus + Gemini (+ optional GPT) + initial intuition.
 * Forces ONE final recommendation + mandatory Kill Switch.
 */

import { askClaude } from '../../../lib/lab/llm-clients'
import { safeParseClaudeJson } from '../../../lib/audit/safe-json'
import { createAdminClient } from '../../../lib/supabase/admin'
import { updateDive } from '../queue'

interface SynthesisResult {
  final_recommendation: string
  rationale: string
  kill_switch_scenario: string
  kill_switch_severity: number
  alternatives_rejected: Array<{ alt: string; why_rejected: string }>
  confidence: number
  estimated_effort_hours: number
}

export async function runSynthesisAndKillSwitch(
  diveId: string,
  intuitionSolution: string | null,
  targetMetric: string,
): Promise<{ killSwitchSeverity: number; cost: number }> {
  console.log('[lab:synthesis] Running synthesis + kill switch...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: councilRows } = await admin
    .from('lab_council_responses')
    .select('llm_provider, response_solution, response_concerns, response_raw')
    .eq('deep_dive_id', diveId)

  const council = councilRows ?? []
  const sonnetSol = council.find((c: { llm_provider: string }) => c.llm_provider === 'claude_sonnet' || c.llm_provider === 'claude')?.response_solution ?? 'N/A'
  const opusSol = council.find((c: { llm_provider: string }) => c.llm_provider === 'claude_opus')?.response_solution ?? 'N/A'
  const geminiSol = council.find((c: { llm_provider: string }) => c.llm_provider === 'gemini')?.response_solution ?? 'N/A'
  const gptSol = council.find((c: { llm_provider: string }) => c.llm_provider === 'openai')?.response_solution

  const gptSection = gptSol ? `\n\nGPT COUNCIL: ${gptSol}` : ''

  const prompt = `Phase 4 — Final Synthesis + Kill Switch

You are synthesizing multiple independent LLM council responses + an initial intuition.

INTUITION (pre-research baseline): ${intuitionSolution ?? 'N/A'}

CLAUDE SONNET COUNCIL: ${sonnetSol}

CLAUDE OPUS COUNCIL: ${opusSol}

GEMINI COUNCIL: ${geminiSol}${gptSection}

TARGET METRIC: ${targetMetric}

YOUR TASK:
1. Where do the LLMs CONVERGE? (high confidence signal)
2. Where do they DIVERGE? (interesting tension)
3. What did research-backed answers add vs raw intuition?
4. Propose ONE final recommendation — the BEST possible solution.
5. List 2-3 alternatives that were REJECTED and why.
6. MANDATORY KILL SWITCH: "What would make this solution COMPLETELY WRONG?"
   - Be specific and paranoid
   - Rate severity (1-10): 10 = certain failure, 1 = unlikely edge case
7. Final confidence (1-10)
8. Estimated effort in hours — IMPORTANT: Samy implements via Claude Code CLI (not manual coding).
   Claude Code is 5-10x faster than human devs. Use this scale:
   - Trivial fix (1-line change): 0.25h
   - Small refactor (1-2 files, <50 lines): 0.5-1h
   - Medium feature (3-5 files, <200 lines): 1-3h
   - Large feature (multiple files, schema changes): 3-8h
   - Massive refactor: 8-16h

Output strict JSON:
{
  "final_recommendation": "2-3 paragraphs, specific and actionable",
  "rationale": "why this beats the alternatives",
  "kill_switch_scenario": "what would make this completely wrong",
  "kill_switch_severity": <1-10>,
  "alternatives_rejected": [{"alt": "...", "why_rejected": "..."}],
  "confidence": <1-10>,
  "estimated_effort_hours": <number>
}`

  const response = await askClaude(prompt, 4096)
  const parsed = safeParseClaudeJson<SynthesisResult>(response.text, {
    final_recommendation: 'Synthesis failed',
    rationale: 'N/A',
    kill_switch_scenario: 'Unknown',
    kill_switch_severity: 5,
    alternatives_rejected: [],
    confidence: 3,
    estimated_effort_hours: 0,
  })

  await updateDive(diveId, {
    final_recommendation: parsed.final_recommendation,
    recommendation_rationale: parsed.rationale,
    kill_switch_scenario: parsed.kill_switch_scenario,
    kill_switch_severity: Math.min(10, Math.max(1, parsed.kill_switch_severity)),
    alternatives_rejected: parsed.alternatives_rejected,
    confidence: Math.min(10, Math.max(1, parsed.confidence)),
    estimated_effort_hours: parsed.estimated_effort_hours,
    synthesis_completed_at: new Date().toISOString(),
  })

  console.log(`[lab:synthesis] Done. Confidence: ${parsed.confidence}/10, Kill switch severity: ${parsed.kill_switch_severity}/10`)
  return { killSwitchSeverity: parsed.kill_switch_severity, cost: response.cost_usd }
}
