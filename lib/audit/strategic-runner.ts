import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../supabase/admin'
import { logAiCall } from '../ai/call-logger'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface StrategicMove {
  title: string
  description: string
  impact: number
  effort: number
  confidence: number
  evidence: string
  category: 'feature' | 'optimization' | 'integration' | 'pivot'
}

export interface StrategicResult {
  top_moves: StrategicMove[]
  backlog: StrategicMove[]
  anti_suggestion: string
}

export async function runStrategicAgent(opts: {
  agent_type: 'strategist' | 'ai_scout' | 'revenue'
  persona_prompt: string
  inputs: Record<string, unknown>
}): Promise<StrategicResult> {
  const systemPrompt = `You are ${opts.persona_prompt}.

You are proposing strategic moves for viralanimal.com, a video editing SaaS that helps creators boost clip virality (karaoke captions, hook text, auto-cut, AI viral scoring).

CRITICAL RULES:
1. MAX 3 moves in "top_moves". Extra ideas go in "backlog".
2. Each move REQUIRES all fields:
   - title (short, action-oriented, max 80 chars)
   - description (specific implementation plan, max 500 chars)
   - impact (1-10, where 10 = transforms the business)
   - effort (1-10, where 10 = months of work)
   - confidence (1-10, how confident you are this will work)
   - evidence (REQUIRED — cite a finding ID, metric value, data point, or external source URL. If you cannot provide evidence, do NOT include the move.)
   - category (feature | optimization | integration | pivot)
3. Add an "anti_suggestion": what should NOT be done this week and why.
4. Be brutally specific. "Improve onboarding" is banned. "Add 3-step wizard that auto-selects caption template based on clip mood" is good.

Output JSON only:
{
  "top_moves": [{ "title": "...", "description": "...", "impact": 8, "effort": 3, "confidence": 7, "evidence": "...", "category": "feature" }],
  "backlog": [...],
  "anti_suggestion": "Do NOT ... because ..."
}`

  const userPrompt = `Inputs:\n${JSON.stringify(opts.inputs, null, 2)}`

  const startMs = Date.now()
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const latencyMs = Date.now() - startMs

  logAiCall({
    model: 'claude-sonnet-4-6',
    feature: 'audit_agent',
    tokensInput: response.usage?.input_tokens,
    tokensOutput: response.usage?.output_tokens,
    latencyMs,
    success: true,
    metadata: { agent_name: opts.agent_type },
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json: StrategicResult = JSON.parse(
    text.match(/\{[\s\S]*\}/)?.[0] ?? '{"top_moves":[],"backlog":[],"anti_suggestion":""}'
  )

  // Calculate Monday of current week for proposed_week_of
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekOf = monday.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Insert top moves
  for (const move of json.top_moves?.slice(0, 3) ?? []) {
    await admin.from('strategic_moves').insert({
      agent_type: opts.agent_type,
      title: move.title,
      description: move.description,
      impact: clamp(move.impact, 1, 10),
      effort: clamp(move.effort, 1, 10),
      confidence: clamp(move.confidence, 1, 10),
      evidence: move.evidence,
      category: move.category,
      proposed_week_of: weekOf,
      status: 'proposed',
    })
  }

  // Insert backlog items as 'parked'
  for (const move of json.backlog?.slice(0, 10) ?? []) {
    await admin.from('strategic_moves').insert({
      agent_type: opts.agent_type,
      title: move.title,
      description: move.description,
      impact: clamp(move.impact, 1, 10),
      effort: clamp(move.effort, 1, 10),
      confidence: clamp(move.confidence, 1, 10),
      evidence: move.evidence,
      category: move.category,
      proposed_week_of: weekOf,
      status: 'parked',
    })
  }

  console.log(`[${opts.agent_type}] ${json.top_moves?.length ?? 0} moves proposed, ${json.backlog?.length ?? 0} parked`)
  if (json.anti_suggestion) {
    console.log(`[${opts.agent_type}] Anti-suggestion: ${json.anti_suggestion.slice(0, 120)}...`)
  }

  return json
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export { claude }
