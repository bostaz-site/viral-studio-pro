/**
 * AI Multiplier Agent — runs TUESDAY + SATURDAY
 *
 * Scans critical codebase files and identifies opportunities where
 * modern AI capabilities could replace rule-based / manual implementations.
 *
 * Run: npx tsx scripts/audits/ai-multiplier.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../../lib/supabase/admin'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import targets from '../../lib/audit/ai-multiplier-targets.json'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_OPPORTUNITIES_PER_RUN = 5

interface Target {
  path: string
  priority: number
  description: string
}

interface Opportunity {
  file_path: string
  component_description: string
  current_implementation: string
  proposed_ai_solution: string
  ai_capability: string
  predicted_lift_metric: string
  predicted_lift_value: number
  estimated_effort_hours: number
  code_sketch: string
  impact_score: number
  confidence_score: number
}

export async function runAIMultiplier() {
  console.log('[ai-multiplier] Starting AI opportunity scan...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const projectRoot = process.cwd()

  // Get already-proposed file paths to avoid duplicates
  const { data: existingOpps } = await admin
    .from('ai_multiplier_opportunities')
    .select('file_path, component_description')
    .in('status', ['proposed', 'in_progress'])

  const existingKeys = new Set(
    (existingOpps ?? []).map(
      (o: { file_path: string; component_description: string }) =>
        `${o.file_path}::${o.component_description}`
    )
  )

  // Sort targets by priority (lower = higher priority)
  const sortedTargets = [...(targets as Target[])].sort(
    (a, b) => a.priority - b.priority
  )

  let opportunitiesFound = 0

  for (const target of sortedTargets) {
    if (opportunitiesFound >= MAX_OPPORTUNITIES_PER_RUN) break

    const filePath = join(projectRoot, target.path)
    if (!existsSync(filePath)) {
      console.log(`[ai-multiplier] Skipping ${target.path} (not found)`)
      continue
    }

    let fileContent: string
    try {
      fileContent = readFileSync(filePath, 'utf-8')
    } catch {
      console.log(`[ai-multiplier] Skipping ${target.path} (read error)`)
      continue
    }

    // Truncate very large files
    const content = fileContent.slice(0, 8000)

    console.log(`[ai-multiplier] Analyzing ${target.path}...`)

    try {
      const opportunities = await analyzeFile(
        target.path,
        target.description,
        content
      )

      for (const opp of opportunities) {
        const key = `${opp.file_path}::${opp.component_description}`
        if (existingKeys.has(key)) {
          console.log(`[ai-multiplier] Skipping duplicate: ${key}`)
          continue
        }
        if (opportunitiesFound >= MAX_OPPORTUNITIES_PER_RUN) break

        await admin.from('ai_multiplier_opportunities').insert({
          file_path: opp.file_path,
          component_description: opp.component_description,
          current_implementation: opp.current_implementation,
          proposed_ai_solution: opp.proposed_ai_solution,
          ai_capability: opp.ai_capability,
          predicted_lift_metric: opp.predicted_lift_metric,
          predicted_lift_value: opp.predicted_lift_value,
          estimated_effort_hours: opp.estimated_effort_hours,
          code_sketch: opp.code_sketch,
          impact_score: opp.impact_score,
          confidence_score: opp.confidence_score,
        })

        existingKeys.add(key)
        opportunitiesFound++
        console.log(
          `[ai-multiplier] Found: ${opp.component_description} (impact=${opp.impact_score}, confidence=${opp.confidence_score})`
        )
      }
    } catch (err) {
      console.error(`[ai-multiplier] Error analyzing ${target.path}:`, err)
    }
  }

  console.log(
    `[ai-multiplier] Done. ${opportunitiesFound} new opportunities found.`
  )
}

async function analyzeFile(
  filePath: string,
  description: string,
  content: string
): Promise<Opportunity[]> {
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a principal AI engineer who reads every Anthropic/OpenAI release and immediately maps capabilities to existing codebases.

Your job: read a source file and identify components where modern AI could REPLACE or AUGMENT the current implementation with measurably better results.

Output JSON only:
{
  "opportunities": [
    {
      "component_description": "What the component does (max 100 chars)",
      "current_implementation": "How it works now (max 200 chars)",
      "proposed_ai_solution": "What AI approach to use instead (max 300 chars)",
      "ai_capability": "claude_vision|claude_text|whisper_v3|elevenlabs|gpt4_vision|gemini_video|custom_ml",
      "predicted_lift_metric": "accuracy|speed_ms|cost_per_call|user_satisfaction",
      "predicted_lift_value": 25,
      "estimated_effort_hours": 8,
      "code_sketch": "// Key code snippet showing the new approach (max 500 chars)",
      "impact_score": 1-10,
      "confidence_score": 1-10
    }
  ]
}

Rules:
- Max 3 opportunities per file
- ONLY propose when there's a CLEAR advantage (not "AI could maybe help")
- impact_score: 10 = transforms the product, 1 = marginal improvement
- confidence_score: 10 = proven technique, 1 = speculative
- estimated_effort_hours: realistic (include testing + edge cases)
- code_sketch: actual TypeScript/JS, not pseudocode
- Prefer Claude capabilities (we have Anthropic API access)
- If no clear AI opportunity exists, return { "opportunities": [] }`,
    messages: [
      {
        role: 'user',
        content: `Analyze this file for AI upgrade opportunities.

File: ${filePath}
Description: ${description}

\`\`\`
${content}
\`\`\``,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0])
  return (parsed.opportunities ?? []).map((o: Partial<Opportunity>) => ({
    file_path: filePath,
    component_description: o.component_description ?? '',
    current_implementation: o.current_implementation ?? '',
    proposed_ai_solution: o.proposed_ai_solution ?? '',
    ai_capability: o.ai_capability ?? 'claude_text',
    predicted_lift_metric: o.predicted_lift_metric ?? 'accuracy',
    predicted_lift_value: o.predicted_lift_value ?? 0,
    estimated_effort_hours: o.estimated_effort_hours ?? 0,
    code_sketch: o.code_sketch ?? '',
    impact_score: Math.min(10, Math.max(1, o.impact_score ?? 5)),
    confidence_score: Math.min(10, Math.max(1, o.confidence_score ?? 5)),
  }))
}

if (typeof require !== 'undefined' && require.main === module) {
  import('dotenv').then((d) => d.config({ path: '.env.local' }))
  runAIMultiplier()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ai-multiplier] Fatal:', err)
      process.exit(1)
    })
}
