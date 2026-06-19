/**
 * Phase 5 — Deliverable (~2 min)
 *
 * Generates:
 * - Full structured markdown in deliverable_markdown
 * - Ready-to-execute Claude Code prompt in claude_code_prompt
 * - Enriches Knowledge Graph with new nodes/edges
 */

import { askClaude } from '../../../lib/lab/llm-clients'
import { upsertNode, upsertEdge } from '../../../lib/audit/graph-aware'
import { safeParseClaudeJson } from '../../../lib/audit/safe-json'
import { createAdminClient } from '../../../lib/supabase/admin'
import { updateDive } from '../queue'

export async function generateDeliverable(diveId: string): Promise<{ cost: number }> {
  console.log('[lab:deliverable] Generating deliverable...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Fetch the full dive
  const { data: dive } = await admin
    .from('lab_deep_dives')
    .select('*')
    .eq('id', diveId)
    .single()

  if (!dive) throw new Error(`Dive ${diveId} not found`)

  // Generate Claude Code prompt
  const promptGenResponse = await askClaude(`Generate a ready-to-paste Claude Code prompt for implementing this product recommendation.

FEATURE: ${dive.feature_area}
RECOMMENDATION: ${dive.final_recommendation}
TARGET METRIC: ${dive.target_metric}
ESTIMATED EFFORT: ${dive.estimated_effort_hours}h

The prompt should:
1. Start with a clear title and context
2. List exactly what to build (files to create/modify)
3. Include acceptance criteria
4. Include the commit message
5. Be specific enough that Claude Code can execute it without ambiguity

Output the prompt as plain text (not JSON). Start with "# " title.`, 4096)

  // Build deliverable markdown
  const markdown = `# Lab Deep Dive — ${dive.feature_area} (cycle #${dive.cycle_number})

## Intuition Snap (pre-research baseline)
- **Solution:** ${dive.intuition_solution ?? 'N/A'}
- **Risk:** ${dive.intuition_risk ?? 'N/A'}
- **Metric:** ${dive.intuition_metric ?? 'N/A'}

## Target Metric (forced clarity)
- **Metric:** \`${dive.target_metric}\`
- **Minimum delta:** ${dive.target_delta_minimum ?? 'TBD'}
- **Measurement:** ${dive.measurement_method ?? 'TBD'}
- **Clarity:** ${dive.metric_clarity_score}/10

## Research Synthesis
${dive.research_synthesis ?? 'No research conducted.'}

## FINAL RECOMMENDATION
${dive.final_recommendation ?? 'No recommendation generated.'}

**Rationale:** ${dive.recommendation_rationale ?? 'N/A'}

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
${dive.kill_switch_scenario ?? 'N/A'}
**Severity:** ${dive.kill_switch_severity ?? '?'}/10

## Alternatives Rejected
${(dive.alternatives_rejected ?? []).map((a: { alt: string; why_rejected: string }) => `- **${a.alt}:** ${a.why_rejected}`).join('\n') || '- None listed'}

## Confidence & Effort
- **Confidence:** ${dive.confidence ?? '?'}/10
- **Estimated effort:** ${dive.estimated_effort_hours ?? '?'}h
`

  await updateDive(diveId, {
    deliverable_markdown: markdown,
    claude_code_prompt: promptGenResponse.text,
    deliverable_completed_at: new Date().toISOString(),
    status: 'completed',
  })

  // Enrich Knowledge Graph
  await enrichKgFromDive(dive)

  console.log('[lab:deliverable] Done.')
  return { cost: promptGenResponse.cost_usd }
}

async function enrichKgFromDive(dive: Record<string, unknown>) {
  try {
    const featureArea = dive.feature_area as string
    const recommendation = (dive.final_recommendation as string) ?? ''

    // Extract KG insights from the recommendation
    const response = await askClaude(`Extract knowledge graph nodes from this product recommendation.

Feature: ${featureArea}
Recommendation: ${recommendation.slice(0, 2000)}

Output JSON:
{
  "industry_patterns": ["pattern1", "pattern2"],
  "user_pains": ["pain1", "pain2"],
  "opportunities": ["opp1"]
}`, 500)

    const parsed = safeParseClaudeJson<{
      industry_patterns: string[]
      user_pains: string[]
      opportunities: string[]
    }>(response.text, { industry_patterns: [], user_pains: [], opportunities: [] })

    // Upsert nodes and edges
    for (const pattern of parsed.industry_patterns.slice(0, 3)) {
      await upsertNode('feature', pattern, `Industry pattern for ${featureArea}`, 5)
      await upsertEdge('feature', featureArea, 'feature', pattern, 'similar_to', 0.6, 'lab-deep-dive')
    }

    for (const pain of parsed.user_pains.slice(0, 3)) {
      await upsertNode('metric', pain, `User pain for ${featureArea}`, 6)
      await upsertEdge('feature', featureArea, 'metric', pain, 'affects', 0.7, 'lab-deep-dive')
    }
  } catch (err) {
    console.warn('[lab:deliverable] KG enrichment failed (non-blocking):', err)
  }
}
