import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../supabase/admin'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ROIPrediction {
  predicted_impact_revenue: number
  predicted_impact_conversion: number
  predicted_impact_ux: number
  predicted_effort_hours: number
  predicted_confidence: number
}

/**
 * Predict ROI for a finding using Claude Haiku.
 * Reads past outcome_measurements to calibrate predictions (learning loop).
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
      .select(
        'predicted_impact_revenue, predicted_impact_conversion, actual_lift_percent, did_it_work'
      )
      .not('did_it_work', 'is', null)
      .order('measured_at', { ascending: false })
      .limit(10)

    // Get similar past findings with ROI for context
    const { data: similarFindings } = await admin
      .from('audit_findings')
      .select(
        'title, severity, predicted_impact_revenue, predicted_impact_conversion, predicted_effort_hours, roi_score'
      )
      .eq('agent_type', finding.agent_type)
      .not('predicted_confidence', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    const calibrationNote =
      (pastOutcomes ?? []).length > 0
        ? `Past calibration data (${(pastOutcomes ?? []).length} measured outcomes):
${(pastOutcomes ?? [])
  .map(
    (o: {
      predicted_impact_revenue: number | null
      actual_lift_percent: number | null
      did_it_work: boolean | null
    }) =>
      `- predicted $${o.predicted_impact_revenue ?? 0}/mo → actual ${o.actual_lift_percent ?? 0}% lift → ${o.did_it_work ? 'worked' : 'did not work'}`
  )
  .join('\n')}
Use this to calibrate your predictions (don't over-predict).`
        : 'No past outcome data yet. Be conservative in predictions.'

    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You predict the business impact of fixing software issues.
Output JSON only:
{
  "predicted_impact_revenue": 0,
  "predicted_impact_conversion": 0,
  "predicted_impact_ux": 5,
  "predicted_effort_hours": 2,
  "predicted_confidence": 7
}

Fields:
- predicted_impact_revenue: estimated monthly revenue lift in USD (0 if not revenue-related)
- predicted_impact_conversion: estimated conversion rate lift as percentage points (0 if N/A)
- predicted_impact_ux: UX improvement score 1-10 (1=trivial, 10=game-changing)
- predicted_effort_hours: hours to fix (include testing)
- predicted_confidence: 1-10 how confident you are in these predictions

Product context: Viral Animal is a video editing SaaS for creators. ~$0 MRR currently (pre-revenue). Focus on activation and retention.
Be conservative. Don't inflate numbers.`,
      messages: [
        {
          role: 'user',
          content: `Predict ROI for this finding:

Agent: ${finding.agent_type}
Severity: ${finding.severity}
Title: ${finding.title}
Description: ${finding.description}
Location: ${finding.location ?? 'N/A'}
Suggested fix: ${finding.suggested_fix ?? 'N/A'}

${calibrationNote}

${
  (similarFindings ?? []).length > 0
    ? `Similar past findings from this agent:\n${(similarFindings ?? [])
        .map(
          (f: {
            title: string
            predicted_impact_revenue: number | null
            predicted_effort_hours: number | null
          }) =>
            `- "${f.title}" → $${f.predicted_impact_revenue ?? '?'}/mo, ${f.predicted_effort_hours ?? '?'}h`
        )
        .join('\n')}`
    : ''
}`,
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    return {
      predicted_impact_revenue: Math.max(0, parsed.predicted_impact_revenue ?? 0),
      predicted_impact_conversion: Math.max(
        0,
        parsed.predicted_impact_conversion ?? 0
      ),
      predicted_impact_ux: Math.min(
        10,
        Math.max(1, parsed.predicted_impact_ux ?? 5)
      ),
      predicted_effort_hours: Math.max(
        0.5,
        parsed.predicted_effort_hours ?? 1
      ),
      predicted_confidence: Math.min(
        10,
        Math.max(1, parsed.predicted_confidence ?? 5)
      ),
    }
  } catch (err) {
    console.error('[roi-predictor] Failed:', err)
    return null
  }
}
