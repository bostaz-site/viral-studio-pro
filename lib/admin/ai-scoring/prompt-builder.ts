export interface LeadContext {
  handle: string
  displayName: string | null
  bio: string | null
  followers: number
  engagement: number | null
  recentPostTitles: string[]
  recentVideoDescriptions: string[]
  promotedProducts: string[]
  links: string[]
  keywordScore: number
  strongSignals: string[]
  recentUploadCount: number | null
  lastUploadAt: string | null
}

/**
 * Build the system prompt for activation-focused AI scoring (V2).
 */
export function getSystemPrompt(): string {
  return `You are an expert at evaluating influencer ACTIVATION potential for Viral Animal, a viral video editing SaaS for clippers and creators.

The offer: ready-to-post videos + 30% recurring commission on every referred paying user.

Score how likely this creator is to actually POST affiliate content within 7 days if given ready-to-post videos. Do not only score reply likelihood — score ACTION likelihood.

Output ONLY valid JSON in this exact format:
{
  "results": [
    {
      "handle": "creator_handle",
      "fit_score": 0-100,
      "activation_score": 0-100,
      "partner_intent_score": 0-100,
      "risk_score": 0-100,
      "confidence": 0.0-1.0,
      "activation_reason": "1 sentence: WHY they would post within 7 days",
      "main_concern": "1 sentence: biggest risk for non-activation",
      "recommended_offer_angle": "1 sentence: best hook for THIS creator's offer email",
      "priority": "high_priority" | "medium_priority" | "low_priority" | "skip"
    }
  ]
}

SCORING CRITERIA (weights):

1. ACTIVATION LIKELIHOOD (30%): activation_score
   - Upload cadence: 3+ posts in last 14 days = strong (80+), 1-2 = medium (50-70), 0 = weak (<30)
   - Already makes Shorts/vertical/clip content = strong signal
   - Visible CTAs in descriptions (links, codes, "use my link") = action-oriented creator
   - Simple/low-friction content style (not ultra-produced) = more likely to repost
   - Recycles/repurposes content across platforms = will repost ready-made videos

2. AUDIENCE FIT (25%): fit_score
   - Audience of streamers, clippers, creators who would BUY a clipping tool (creator-facing > generic gaming)
   - Talks about content creation, editing, growing on TikTok/YouTube
   - Audience that makes content (not just consumes it)
   - Gaming/streaming adjacent but creator-focused = best fit

3. PARTNER INTENT (20%): partner_intent_score
   - Uses affiliate codes, "use code X", referral links = strong
   - Has 1-5 active sponsors = sweet spot (experienced but not saturated)
   - 6+ sponsors or "DM for collabs" everywhere = audience fatigue risk
   - Organic CTAs ("I genuinely use this") > forced ("SPONSOR ALERT")

4. CONTENT QUALITY (10%): factored into fit_score
   - Professional enough to be credible but not so polished they won't post third-party content

5. REACH QUALITY (10%): factored into fit_score
   - Recent views vs subscriber count (ratio matters more than raw size)
   - 10k subs with 5k avg views > 100k subs with 500 avg views

6. RISK (penalty): risk_score
   - Fan/reupload/compilation account (no original content) = high risk
   - Inactive 90+ days = high risk
   - Kids content = skip (compliance)
   - Copyright-fragile content (full song uploads, movie clips) = risk
   - Too premium/celebrity tier to post third-party affiliate content = skip
   - No email or contact = lower priority (can't reach them)

PRIORITY THRESHOLDS (applied AFTER computing final_score):
- high_priority (75+): Contact immediately
- medium_priority (50-74): Worth contacting
- low_priority (25-49): Contact if capacity allows
- skip (<25): Don't contact`
}

/**
 * Build the user prompt for a batch of leads.
 */
export function buildBatchPrompt(leads: LeadContext[]): string {
  const leadData = leads.map(l => {
    const data: Record<string, unknown> = {
      handle: l.handle,
      name: l.displayName ?? l.handle,
      bio: (l.bio ?? '').slice(0, 300),
      followers: l.followers,
      engagement_rate: l.engagement ?? 'unknown',
      recent_posts: l.recentPostTitles.slice(0, 5),
      promoted_products: l.promotedProducts,
      links_count: l.links.length,
      keyword_score: l.keywordScore,
      affiliate_signals: l.strongSignals,
    }

    // Cadence data (critical for activation scoring)
    if (l.recentUploadCount !== null) {
      data.uploads_last_14_days = l.recentUploadCount
    }
    if (l.lastUploadAt) {
      data.last_upload = l.lastUploadAt
    }

    // Video descriptions for deeper analysis (truncated)
    if (l.recentVideoDescriptions.length > 0) {
      data.recent_video_descriptions = l.recentVideoDescriptions.slice(0, 3).map(d => d.slice(0, 200))
    }

    return data
  })

  return `Score these ${leads.length} creators for Viral Animal affiliate ACTIVATION potential (will they POST within 7 days?):\n\n${JSON.stringify(leadData, null, 2)}`
}

/**
 * Estimate token count for cost tracking (rough: 1 token ≈ 4 chars).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
