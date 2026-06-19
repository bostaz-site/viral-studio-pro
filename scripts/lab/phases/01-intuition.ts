/**
 * Phase 0 — Intuition Snap (~2 min)
 *
 * Claude responds BEFORE any research. Baseline to compare
 * against the final answer (did research actually help?).
 */

import { askClaude } from '../../../lib/lab/llm-clients'
import { safeParseClaudeJson } from '../../../lib/audit/safe-json'
import { updateDive } from '../queue'

interface IntuitionResult {
  solution: string
  risk: string
  metric: string
}

export async function runIntuitionSnap(diveId: string, featureArea: string, featureName: string) {
  console.log('[lab:intuition] Starting intuition snap...')

  const prompt = `You are analyzing the "${featureName}" feature (area: ${featureArea}) of Viral Animal, a SaaS that helps streamers go viral with clip editing tools.

BEFORE doing any research, respond with your pure intuition:

1. What is the most likely improvement that would have the highest impact?
2. What is the main risk or failure mode of this feature?
3. What single metric would best measure success?

Be brief, firm, instinctive. No hedging, no research.

Output JSON:
{
  "solution": "your intuitive answer in 2-3 sentences",
  "risk": "main risk in 1-2 sentences",
  "metric": "exact metric name and what it measures"
}`

  const response = await askClaude(prompt, 1000)
  const parsed = safeParseClaudeJson<IntuitionResult>(response.text, {
    solution: 'No intuition generated',
    risk: 'Unknown',
    metric: 'Unknown',
  })

  await updateDive(diveId, {
    intuition_solution: parsed.solution,
    intuition_risk: parsed.risk,
    intuition_metric: parsed.metric,
    intuition_completed_at: new Date().toISOString(),
  })

  console.log(`[lab:intuition] Done. Intuitive metric: ${parsed.metric}`)
  return { cost: response.cost_usd }
}
