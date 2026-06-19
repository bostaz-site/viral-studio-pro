/**
 * Phase 2 — Deep Research (~15 min)
 *
 * Claude orchestrates research:
 * - Competitor analysis (how they do this feature)
 * - Industry best practices synthesis
 * - Pain points from users
 *
 * Uses Claude to synthesize findings into a research dossier.
 */

import { askClaude } from '../../../lib/lab/llm-clients'
import { safeParseClaudeJson } from '../../../lib/audit/safe-json'
import { updateDive } from '../queue'
import type { FeatureConfig } from '../../../lib/lab/types'

interface CompetitorAnalysis {
  name: string
  approach: string
  strengths: string
  weaknesses: string
}

export async function runDeepResearch(
  diveId: string,
  feature: FeatureConfig,
  founderGoals: string
) {
  console.log('[lab:research] Starting deep research...')
  let totalCost = 0

  // Competitor analysis via Claude's knowledge
  const competitors: CompetitorAnalysis[] = []
  if (feature.competitors.length > 0) {
    const competitorPrompt = `Analyze how these competitors handle "${feature.name}" (${feature.area}):

Competitors: ${feature.competitors.join(', ')}

For each competitor, provide:
1. How they approach this feature (key UX patterns, flow)
2. Strengths of their approach
3. Weaknesses or opportunities they miss

Context: Viral Animal is a clip editing SaaS for streamers (Twitch, Kick, YouTube).

CRITICAL: Respond with ONLY a valid JSON array. NO markdown. NO \`\`\`json fences. NO prose before or after. Start with [ and end with ].

[{"name": "...", "approach": "...", "strengths": "...", "weaknesses": "..."}]`

    const compResponse = await askClaude(competitorPrompt, 3000)
    totalCost += compResponse.cost_usd
    const parsed = safeParseClaudeJson<CompetitorAnalysis[]>(compResponse.text, [])
    competitors.push(...parsed)
  }

  // Industry research synthesis
  const researchPrompt = `You are a product strategist researching "${feature.name}" for a clip editing SaaS (Viral Animal).

COMPETITOR FINDINGS:
${competitors.map(c => `- ${c.name}: ${c.approach} | Strengths: ${c.strengths} | Weaknesses: ${c.weaknesses}`).join('\n')}

FOUNDER CONTEXT:
${founderGoals}

Based on your knowledge of SaaS best practices, UX research, and the video editing industry in 2025-2026:

Produce a 5-section research synthesis:
1. **Industry consensus** — What most experts/products agree on for ${feature.area}
2. **Industry disagreement** — Where opinions split
3. **Competitor best moves** — The smartest things competitors do
4. **User-reported pains** — Common complaints from users of similar tools (Reddit, forums, reviews)
5. **Opportunities for Viral Animal** — Gaps in the market, underserved needs

Be specific with examples. Each section 3-5 sentences.`

  const synthResponse = await askClaude(researchPrompt, 3000)
  totalCost += synthResponse.cost_usd

  // Store research articles as structured insights from Claude's knowledge
  const articles = competitors.map(c => ({
    url: `competitor:${c.name}`,
    title: `${c.name} — ${feature.area} analysis`,
    key_insight: c.approach,
  }))

  await updateDive(diveId, {
    research_articles: articles,
    research_competitors: competitors,
    research_synthesis: synthResponse.text,
    research_completed_at: new Date().toISOString(),
  })

  console.log(`[lab:research] Done. ${competitors.length} competitors analyzed`)
  return { cost: totalCost }
}
