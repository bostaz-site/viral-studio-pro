/**
 * Generates a Lab prompt markdown file from a deep dive record.
 * Used by both the admin dashboard PATCH handler and the Discord interactions handler.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateLabPrompt(dive: any): string {
  const alts = Array.isArray(dive.alternatives_rejected)
    ? dive.alternatives_rejected.map((a: { alt: string; why_rejected: string }) => `- ${a.alt}: ${a.why_rejected}`).join('\n')
    : '- None recorded'

  const ccEffort = Math.max(0.25, Math.round((dive.estimated_effort_hours ?? 2) / 5 * 10) / 10)

  return `# Lab Prompt — ${dive.feature_area} (cycle #${dive.cycle_number})

> Auto-generated from Lab deep dive on ${new Date().toISOString().slice(0, 10)}

## Target Metric
**${dive.target_metric ?? 'N/A'}** — minimum delta: ${dive.target_delta_minimum ?? 'N/A'}

Measurement: ${dive.measurement_method ?? 'N/A'}

## Final Recommendation
${dive.final_recommendation ?? 'N/A'}

## Rationale
${dive.recommendation_rationale ?? 'N/A'}

## Kill Switch — MUST ADDRESS (severity ${dive.kill_switch_severity ?? '?'}/10)
${dive.kill_switch_scenario ?? 'None identified'}

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
${alts}

## Effort
~${ccEffort}h with Claude Code (${dive.estimated_effort_hours ?? '?'}h human estimate)

## Confidence: ${dive.confidence ?? '?'}/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (\`npm run build\`)
- [ ] Commit: \`feat(${dive.feature_area}): lab cycle ${dive.cycle_number}\`
- [ ] Push to origin
`
}

export function buildPromptFilePath(dive: { feature_area: string; cycle_number: number; final_recommendation?: string | null }): { filename: string; filepath: string } {
  const slug = (dive.final_recommendation ?? 'fix')
    .slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const filename = `${dive.feature_area}-cycle${dive.cycle_number}-${slug}.md`
  const filepath = `docs/lab/prompts/${filename}`
  return { filename, filepath }
}
