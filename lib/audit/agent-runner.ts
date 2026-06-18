import Anthropic from '@anthropic-ai/sdk'
import { insertFinding, type NewFinding } from './insert-finding'
import { insertMetricSnapshot } from './insert-metric'
import { safeParseClaudeJson, extractClaudeText } from './safe-json'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AgentContext {
  agent_type: NewFinding['agent_type']
  persona_prompt: string
  inputs: Record<string, unknown>
}

export interface AgentResult {
  findings: Array<{
    severity: 'critical' | 'high' | 'normal' | 'low'
    title: string
    description: string
    location?: string
    suggested_fix?: string
  }>
  metrics: Array<{
    name: string
    value: number
    unit?: string
  }>
}

export async function runAgent(ctx: AgentContext): Promise<AgentResult> {
  const systemPrompt = `You are ${ctx.persona_prompt}.

You are auditing Viral Animal, a video editing SaaS for creators.

Output JSON only, no prose:
{
  "findings": [
    {
      "severity": "critical" | "high" | "normal" | "low",
      "title": "Short punchy title (max 100 chars)",
      "description": "What's wrong, why it matters (max 500 chars)",
      "location": "file:line or surface name (e.g., 'app/page.tsx:42' or 'landing-hero')",
      "suggested_fix": "Concrete actionable fix (max 300 chars)"
    }
  ],
  "metrics": [
    { "name": "metric_name", "value": 42, "unit": "percentage" }
  ]
}

Rules:
- Max 5 findings per run
- ONLY findings that are actionable today, not vague advice
- Prioritize by impact x effort (high impact + low effort = critical)
- If you find no issues, return { "findings": [], "metrics": [] }`

  const userPrompt = `Inputs:\n${JSON.stringify(ctx.inputs, null, 2)}`

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = extractClaudeText(response)
  console.log(`[agent-runner] ${ctx.agent_type} response: ${text.length} chars`)
  const json = safeParseClaudeJson<AgentResult>(text, { findings: [], metrics: [] })

  // Insert findings
  for (const finding of json.findings ?? []) {
    await insertFinding({
      agent_type: ctx.agent_type,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      location: finding.location,
      suggested_fix: finding.suggested_fix,
    })
  }

  // Insert metrics
  for (const metric of json.metrics ?? []) {
    await insertMetricSnapshot({
      metric_name: metric.name,
      metric_value: metric.value,
      metric_unit: metric.unit,
    })
  }

  return json
}

export { claude }
