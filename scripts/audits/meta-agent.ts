/**
 * Meta-Agent — runs SUNDAY night
 *
 * Evaluates each audit agent's performance and proposes prompt refinements.
 * Persona: Senior engineering manager who optimizes agent performance.
 *
 * Run: npx tsx scripts/audits/meta-agent.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../../lib/supabase/admin'
import { readFileSync } from 'fs'
import { join } from 'path'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AGENTS_TO_EVALUATE = [
  'output',
  'acquisition',
  'activation',
  'retention',
  'technical',
  'cold_email',
] as const

interface AgentEvaluation {
  agent: string
  performance_score: number
  findings_actioned_rate: number
  findings_ignored_rate: number
  blind_spots: string[]
  ignored_patterns: string[]
  proposed_prompt_diff: string
  confidence: number
}

export async function runMetaAgent() {
  console.log('[meta-agent] Starting agent performance evaluation...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const periodStart = sevenDaysAgo.toISOString().slice(0, 10)
  const periodEnd = now.toISOString().slice(0, 10)

  for (const agentType of AGENTS_TO_EVALUATE) {
    try {
      await evaluateAgent(admin, agentType, periodStart, periodEnd)
    } catch (err) {
      console.error(`[meta-agent] Failed to evaluate ${agentType}:`, err)
    }
  }

  console.log('[meta-agent] Done.')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateAgent(
  admin: any,
  agentType: string,
  periodStart: string,
  periodEnd: string
) {
  console.log(`[meta-agent] Evaluating ${agentType}...`)

  // 1. Get all findings for this agent in the period
  const { data: findings } = await admin
    .from('audit_findings')
    .select('id, severity, title, description, status, cycle_count, location, created_at')
    .eq('agent_type', agentType)
    .gte('created_at', `${periodStart}T00:00:00Z`)
    .lte('created_at', `${periodEnd}T23:59:59Z`)

  const allFindings = findings ?? []

  if (allFindings.length === 0) {
    console.log(`[meta-agent] ${agentType}: no findings in period, skipping`)
    return
  }

  // 2. Compute performance metrics
  const actioned = allFindings.filter(
    (f: { status: string }) => f.status === 'fixed' || f.status === 'doing'
  ).length
  const ignored = allFindings.filter(
    (f: { status: string }) => f.status === 'ignore' || f.status === 'later'
  ).length
  const total = allFindings.length

  const actionedRate = total > 0 ? actioned / total : 0
  const ignoredRate = total > 0 ? ignored / total : 0

  // 3. Get all findings ever to detect blind spots
  const { data: allTimeFindings } = await admin
    .from('audit_findings')
    .select('location')
    .eq('agent_type', agentType)
    .not('location', 'is', null)

  const auditedLocations = new Set(
    (allTimeFindings ?? [])
      .map((f: { location: string | null }) => f.location)
      .filter(Boolean)
  )

  // 4. Read current agent prompt
  let currentPrompt = ''
  try {
    const agentFile = agentType === 'cold_email' ? 'cold-email' : agentType
    const filePath = join(process.cwd(), 'scripts', 'audits', `${agentFile}.ts`)
    currentPrompt = readFileSync(filePath, 'utf-8')
  } catch {
    currentPrompt = '[agent file not found]'
  }

  // 5. Ask Claude Opus to evaluate and propose improvements
  const response = await claude.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: `You are a senior engineering manager who optimizes AI agent performance.
You evaluate audit agents and propose prompt refinements based on data.

Output JSON only:
{
  "performance_score": 0-100,
  "blind_spots": ["areas never audited"],
  "ignored_patterns": ["topics frequently ignored by human reviewer"],
  "prompt_improvement": "specific, concise suggestion to improve the agent prompt (max 500 chars)",
  "proposed_prompt_snippet": "the KEY section of prompt to change (max 300 chars, not the full prompt)",
  "confidence": 0-10
}

Rules:
- Performance score: 80+ if >60% actioned, 50-80 if mixed, <50 if mostly ignored
- Blind spots: compare audited locations against what a thorough agent SHOULD check
- Ignored patterns: cluster ignored findings to find systemic prompt issues
- Prompt improvement must be ACTIONABLE, not vague ("add X check" not "be more thorough")
- Keep proposed prompt snippet SHORT — just the delta, not a full rewrite
- Max token budget for proposed prompt: 300 chars`,
    messages: [
      {
        role: 'user',
        content: `Evaluate the "${agentType}" agent.

Period: ${periodStart} to ${periodEnd}

## Findings this period (${total} total)
Actioned (fixed/doing): ${actioned} (${(actionedRate * 100).toFixed(0)}%)
Ignored (ignore/later): ${ignored} (${(ignoredRate * 100).toFixed(0)}%)
Open: ${total - actioned - ignored}

### Severity distribution
- Critical: ${allFindings.filter((f: { severity: string }) => f.severity === 'critical').length}
- High: ${allFindings.filter((f: { severity: string }) => f.severity === 'high').length}
- Normal: ${allFindings.filter((f: { severity: string }) => f.severity === 'normal').length}
- Low: ${allFindings.filter((f: { severity: string }) => f.severity === 'low').length}

### Findings details
${allFindings
  .slice(0, 15)
  .map(
    (f: { severity: string; title: string; status: string; location: string | null }) =>
      `- [${f.severity}] ${f.title} → status: ${f.status} | location: ${f.location ?? 'N/A'}`
  )
  .join('\n')}

### Locations ever audited by this agent
${[...auditedLocations].slice(0, 20).join(', ') || 'none'}

### Current agent script (first 2000 chars)
\`\`\`
${currentPrompt.slice(0, 2000)}
\`\`\``,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn(`[meta-agent] ${agentType}: no JSON in response`)
    return
  }

  const eval_result: AgentEvaluation & {
    prompt_improvement: string
    proposed_prompt_snippet: string
  } = {
    agent: agentType,
    performance_score: 50,
    findings_actioned_rate: actionedRate,
    findings_ignored_rate: ignoredRate,
    blind_spots: [],
    ignored_patterns: [],
    proposed_prompt_diff: '',
    confidence: 5,
    prompt_improvement: '',
    proposed_prompt_snippet: '',
    ...JSON.parse(jsonMatch[0]),
  }

  // 6. Insert report
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('meta_agent_reports').insert({
    agent_evaluated: agentType,
    evaluation_period_start: periodStart,
    evaluation_period_end: periodEnd,
    performance_score: eval_result.performance_score,
    findings_actioned_rate: actionedRate,
    findings_ignored_rate: ignoredRate,
    blind_spots: eval_result.blind_spots,
    ignored_patterns: eval_result.ignored_patterns,
    proposed_prompt_diff: eval_result.prompt_improvement,
    proposed_prompt_full: eval_result.proposed_prompt_snippet,
    confidence_in_proposal: eval_result.confidence,
  })

  // 7. If confidence >= 7, also create a prompt proposal
  if (eval_result.confidence >= 7 && eval_result.prompt_improvement) {
    await admin.from('agent_prompt_proposals').insert({
      agent_name: agentType,
      previous_prompt: currentPrompt.slice(0, 5000),
      proposed_prompt: eval_result.proposed_prompt_snippet,
      rationale: eval_result.prompt_improvement,
    })
    console.log(
      `[meta-agent] ${agentType}: prompt proposal created (confidence=${eval_result.confidence})`
    )
  }

  console.log(
    `[meta-agent] ${agentType}: score=${eval_result.performance_score}, actioned=${(actionedRate * 100).toFixed(0)}%, blind_spots=${eval_result.blind_spots.length}`
  )
}

if (typeof require !== 'undefined' && require.main === module) {
  import('dotenv').then((d) => d.config({ path: '.env.local' }))
  runMetaAgent()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[meta-agent] Fatal:', err)
      process.exit(1)
    })
}
