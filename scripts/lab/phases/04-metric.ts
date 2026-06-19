/**
 * Phase 2.5 — Metric Framing (STOP gate, ~3 min)
 *
 * Forces metric identification BEFORE solution.
 * If clarity < 6 → STOP the deep dive (anti "nice idea" trap).
 *
 * Pre-launch: baseline = null but target_metric and measurement_method
 * must be clear. Ready to plug post-launch.
 */

import { askClaude } from '../../../lib/lab/llm-clients'
import { safeParseClaudeJson } from '../../../lib/audit/safe-json'
import { updateDive } from '../queue'

interface MetricFramingResult {
  target_metric: string
  target_delta_minimum: string
  measurement_method: string
  metric_clarity_score: number
}

export async function runMetricFraming(
  diveId: string,
  featureArea: string,
  founderGoals: string,
  researchSynthesis: string
): Promise<{ clarity: number; cost: number }> {
  console.log('[lab:metric] Running metric framing...')

  const prompt = `Phase 2.5 — Metric Framing

For the feature "${featureArea}" of Viral Animal (clip editing SaaS for streamers):

BEFORE proposing any solution, identify THE metric that matters:

1. target_metric: What EXACT metric must move?
   Examples: 'render_completion_rate', 'time_to_first_clip_seconds', 'enhance_to_publish_rate', 'landing_signup_rate'

2. target_delta_minimum: What minimum delta justifies shipping?
   Examples: '+10pp', '+25%', '-30% time'

3. measurement_method: How do we measure it concretely?
   Example: 'COUNT(clips WHERE status=done) / COUNT(clips WHERE status=rendering) over 7d window'

4. metric_clarity_score: How clear is this metric? (1-10)
   - 10 = obvious, measurable tomorrow
   - 5 = fuzzy, multiple interpretations
   - 1 = pure guesswork

CRITICAL: if clarity < 6, we STOP the deep dive here. No "nice ideas" without measurable metric.

Founder context: ${founderGoals}
Research synthesis: ${researchSynthesis.slice(0, 2000)}

Output strict JSON:
{
  "target_metric": "...",
  "target_delta_minimum": "...",
  "measurement_method": "...",
  "metric_clarity_score": <number>
}`

  const response = await askClaude(prompt, 1000)
  const parsed = safeParseClaudeJson<MetricFramingResult>(response.text, {
    target_metric: 'unknown',
    target_delta_minimum: 'unknown',
    measurement_method: 'unknown',
    metric_clarity_score: 3,
  })

  const clarity = Math.min(10, Math.max(1, parsed.metric_clarity_score))

  await updateDive(diveId, {
    target_metric: parsed.target_metric,
    target_delta_minimum: parseFloat(parsed.target_delta_minimum) || null,
    measurement_method: parsed.measurement_method,
    metric_clarity_score: clarity,
    metric_completed_at: new Date().toISOString(),
  })

  console.log(`[lab:metric] Clarity: ${clarity}/10 | Target: ${parsed.target_metric}`)
  return { clarity, cost: response.cost_usd }
}
