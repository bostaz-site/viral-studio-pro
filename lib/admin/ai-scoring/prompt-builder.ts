interface LeadContext {
  handle: string
  displayName: string | null
  bio: string | null
  followers: number
  engagement: number | null
  recentPostTitles: string[]
  promotedProducts: string[]
  links: string[]
  keywordScore: number
  strongSignals: string[]
}

/**
 * Build the system prompt for batch AI scoring.
 */
export function getSystemPrompt(): string {
  return `You are an expert at evaluating influencer affiliate partnership potential for Viral Animal, a viral video editing SaaS.

Score creators on their likelihood to accept and successfully promote Viral Animal as affiliates. They earn 30% recurring commission.

Output ONLY valid JSON in this exact format:
{
  "results": [
    {
      "handle": "creator_handle",
      "ai_score": 0-100,
      "recommendation": "high_priority" | "medium_priority" | "low_priority" | "skip",
      "confidence": 0.0-1.0,
      "strengths": ["strength1", "strength2"],
      "concerns": ["concern1"],
      "reasoning": "1-2 sentence summary"
    }
  ]
}

Scoring criteria weights:
- Niche fit with creator economy/AI/productivity tools (25%)
- Already promotes competitor apps like OpusClip, Submagic, CapCut (25%)
- Audience size & engagement quality (15%)
- Content quality & professionalism signals (15%)
- Activity & likely responsiveness (10%)
- Affiliate signals in bio/posts (10%)

Recommendations:
- high_priority (score 75+): Strong affiliate candidate, contact immediately
- medium_priority (score 50-74): Good potential, worth contacting
- low_priority (score 25-49): Marginal fit, contact if capacity allows
- skip (score <25): Poor fit, don't contact`
}

/**
 * Build the user prompt for a batch of leads.
 */
export function buildBatchPrompt(leads: LeadContext[]): string {
  const leadData = leads.map(l => ({
    handle: l.handle,
    name: l.displayName ?? l.handle,
    bio: (l.bio ?? '').slice(0, 300), // Truncate to save tokens
    followers: l.followers,
    engagement_rate: l.engagement ?? 'unknown',
    recent_posts: l.recentPostTitles.slice(0, 3),
    promoted_products: l.promotedProducts,
    links_count: l.links.length,
    keyword_score: l.keywordScore,
    affiliate_signals: l.strongSignals,
  }))

  return `Score these ${leads.length} creators for Viral Animal affiliate potential:\n\n${JSON.stringify(leadData, null, 2)}`
}

/**
 * Estimate token count for cost tracking (rough: 1 token ≈ 4 chars).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
