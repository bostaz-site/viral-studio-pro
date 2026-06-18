import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../supabase/admin'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ROIPrediction {
  predicted_impact_bucket: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  predicted_impact_reasoning: string
  predicted_impact_ux: number
  predicted_effort_hours: number
  predicted_confidence: number
}

/**
 * Confidence scale:
 * 9-10: backed by past measured outcomes (calibrated)
 * 6-8: backed by industry benchmarks or similar pattern
 * 3-5: educated guess
 * 1-2: high uncertainty
 * 0: don't predict, mark as 'unknown'
 */

/**
 * Predict impact bucket for a finding using Claude Haiku.
 * Uses categorical buckets instead of precise $ predictions (honest > precise).
 */
export async function predictROI(finding: {
  agent_type: string
  severity: string
  title: string
  description: string
  location?: string
  suggested_fix?: string
}): Promise<ROIPrediction | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    // Get past outcomes for calibration
    const { data: pastOutcomes } = await admin
      .from('outcome_measurements')
      .select('predicted_impact_bucket, actual_lift_percent, did_it_work')
      .not('did_it_work', 'is', null)
      .order('measured_at', { ascending: false })
      .limit(10)

    const calibrationNote =
      (pastOutcomes ?? []).length > 0
        ? `Past calibration (${(pastOutcomes ?? []).length} outcomes):
${(pastOutcomes ?? [])
  .map(
    (o: { predicted_impact_bucket: string; actual_lift_percent: number | null; did_it_work: boolean | null }) =>
      `- predicted ${o.predicted_impact_bucket} → actual ${o.actual_lift_percent?.toFixed(1) ?? '?'}% lift → ${o.did_it_work ? 'worked' : 'did not work'}`
  )
  .join('\n')}
Use this to calibrate. If past HIGH predictions only yielded 1% lift, be more conservative.`
        : 'No past outcomes yet. Be conservative.'

    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You predict the impact of fixing software issues for a video editing SaaS (Viral Animal).

Output JSON only:
{
  "predicted_impact_bucket": "critical|high|medium|low|unknown",
  "predicted_impact_reasoning": "1 sentence explaining WHY this bucket",
  "predicted_impact_ux": 5,
  "predicted_effort_hours": 2,
  "predicted_confidence": 7
}

Bucket definitions:
- critical: blocks growth or revenue (checkout broken, auth broken, data loss)
- high: lifts a key metric meaningfully (>5% conversion improvement)
- medium: nice-to-have improvement (1-5% effect on some metric)
- low: cosmetic, marginal, or affects <1% of users
- unknown: impossible to predict without more data

Confidence scale:
- 9-10: backed by measured past outcomes
- 6-8: backed by industry benchmarks or clear similar pattern
- 3-5: educated guess
- 1-2: high uncertainty, wild guess

Be HONEST. "unknown" is better than a wrong prediction.
Product context: ~$0 MRR (pre-revenue), focus on activation + retention.`,
      messages: [{
        role: 'user',
        content: `Predict impact for:

Agent: ${finding.agent_type}
Severity: ${finding.severity}
Title: ${finding.title}
Description: ${finding.description}
Location: ${finding.location ?? 'N/A'}
Suggested fix: ${finding.suggested_fix ?? 'N/A'}

${calibrationNote}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const validBuckets = ['critical', 'high', 'medium', 'low', 'unknown'] as const
    const bucket = validBuckets.includes(parsed.predicted_impact_bucket)
      ? parsed.predicted_impact_bucket
      : 'unknown'

    return {
      predicted_impact_bucket: bucket,
      predicted_impact_reasoning: (parsed.predicted_impact_reasoning ?? '').slice(0, 300),
      predicted_impact_ux: Math.min(10, Math.max(1, parsed.predicted_impact_ux ?? 5)),
      predicted_effort_hours: Math.max(0.5, parsed.predicted_effort_hours ?? 1),
      predicted_confidence: Math.min(10, Math.max(1, parsed.predicted_confidence ?? 5)),
    }
  } catch (err) {
    console.error('[roi-predictor] Failed:', err)
    return null
  }
}
