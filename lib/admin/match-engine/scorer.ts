import { scoreNicheMatch } from './niche-matcher'
import { scoreAudienceMatch, scoreLanguageMatch } from './audience-matcher'

interface PromoVideo {
  id: string
  niche: string[]
  hook_type: string | null
  language: string | null
  target_audience_min?: number
  target_audience_max?: number
}

interface Influencer {
  id: string
  niche: string | null
  tags: string[]
  audience_size: number | null
  language: string | null
  lead_score: number
  primary_platform: string | null
}

export interface MatchResult {
  score: number
  breakdown: { niche: number; audience: number; language: number; hook_fit: number; lead_boost: number }
  matchedNiches: string[]
}

const HOOK_AFFINITIES: Record<string, string[]> = {
  tutorial: ['educator', 'how_to', 'productivity', 'tech', 'saas'],
  transformation: ['before_after', 'fitness', 'business', 'growth'],
  curiosity: ['mystery', 'storytelling', 'reveal', 'entertainment'],
  social_proof: ['review', 'testimonial', 'comparison', 'apps'],
  storytelling: ['irl', 'just_chatting', 'variety', 'entertainment'],
  comparison: ['tech', 'review', 'apps', 'tools'],
  testimonial: ['business', 'saas', 'creator'],
  shock: ['gaming', 'fps', 'entertainment', 'funny'],
}

function scoreHookFit(hookType: string | null, inf: Influencer): number {
  if (!hookType) return 7
  const affinities = HOOK_AFFINITIES[hookType] ?? []
  const traits = [inf.niche?.toLowerCase(), ...(inf.tags ?? []).map(t => t.toLowerCase())].filter(Boolean)
  return affinities.some(a => traits.some(t => t?.includes(a))) ? 15 : 0
}

export function computeMatchScore(video: PromoVideo, influencer: Influencer): MatchResult {
  const nicheResult = scoreNicheMatch(video.niche, influencer.niche, influencer.tags)
  const audience = scoreAudienceMatch(influencer.audience_size, video.target_audience_min ?? 1000, video.target_audience_max ?? 1_000_000)
  const language = scoreLanguageMatch(video.language, influencer.language)
  const hook_fit = scoreHookFit(video.hook_type, influencer)
  const lead_boost = influencer.lead_score >= 80 ? 10 : influencer.lead_score >= 60 ? 7 : influencer.lead_score >= 40 ? 4 : 0

  return {
    score: Math.min(100, nicheResult.score + audience + language + hook_fit + lead_boost),
    breakdown: { niche: nicheResult.score, audience, language, hook_fit, lead_boost },
    matchedNiches: nicheResult.matchedNiches,
  }
}
