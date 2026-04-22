/**
 * Creator Account Scoring Engine — ranks connected social accounts.
 * Phase 1: YouTube. Prepared for TikTok + Instagram.
 *
 * 5 factors: Performance (30%), Engagement (20%), Growth (20%),
 * Audience (15%), Consistency (15%).
 */

export type CreatorRank =
  | 'newcomer'
  | 'creator'
  | 'trending_creator'
  | 'viral_creator'
  | 'elite_creator'
  | 'legendary'
  | 'hidden_gem'

export interface AccountScoreInput {
  followers: number
  total_views: number
  video_count: number
  median_views_per_video: number
  engagement_rate: number
  growth_percent_30d: number | null
  days_since_last_post: number
  shorts_ratio: number
}

export interface AccountScoreOutput {
  creator_score: number
  creator_rank: CreatorRank
  performance_score: number
  engagement_score: number
  growth_score: number
  audience_score: number
  consistency_score: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Factor 1: Content Performance (30%) ─────────────────────────────────────

function computePerformanceScore(input: AccountScoreInput): number {
  const { median_views_per_video, followers, shorts_ratio } = input
  if (followers === 0 || median_views_per_video === 0) return 20

  let ratio = median_views_per_video / followers
  ratio = Math.min(ratio, 3.0)

  let score: number
  if (shorts_ratio > 0.8) {
    score = Math.min(100, ratio * 33)
  } else {
    score = Math.min(100, ratio * 67)
  }

  return clamp(score)
}

// ── Factor 2: Engagement Rate (20%) ─────────────────────────────────────────

function computeEngagementScore(input: AccountScoreInput): number {
  const { engagement_rate, shorts_ratio } = input
  if (engagement_rate === 0) return 20

  const excellentThreshold = shorts_ratio > 0.8 ? 0.08 : 0.05
  const goodThreshold = shorts_ratio > 0.8 ? 0.04 : 0.02

  if (engagement_rate >= excellentThreshold) return 100
  if (engagement_rate >= goodThreshold) return 70
  if (engagement_rate >= 0.01) return 50
  return clamp(engagement_rate / 0.01 * 50)
}

// ── Factor 3: Growth Velocity (20%) ─────────────────────────────────────────

function computeGrowthScore(input: AccountScoreInput): number {
  if (input.growth_percent_30d === null) return 0

  const growth = input.growth_percent_30d
  if (growth <= 0) return Math.max(0, 20 + growth)

  const logGrowth = Math.log(1 + growth)
  return clamp(logGrowth * 20)
}

// ── Factor 4: Audience Size (15%) ───────────────────────────────────────────

function computeAudienceScore(followers: number): number {
  if (followers === 0) return 0
  return clamp(Math.log10(followers) * 20)
}

// ── Factor 5: Consistency (15%) ─────────────────────────────────────────────

function computeConsistencyScore(daysSinceLastPost: number): number {
  if (daysSinceLastPost <= 7) return 100
  if (daysSinceLastPost <= 14) return 75
  if (daysSinceLastPost <= 30) return 50 - (daysSinceLastPost - 14) * 2
  return Math.max(5, 20 - (daysSinceLastPost - 30))
}

// ── Rank Classification ─────────────────────────────────────────────────────

function classifyCreatorRank(
  score: number,
  performanceScore: number,
  audienceScore: number
): CreatorRank {
  if (performanceScore > 80 && audienceScore < 20) return 'hidden_gem'
  if (score >= 90) return 'legendary'
  if (score >= 80) return 'elite_creator'
  if (score >= 60) return 'viral_creator'
  if (score >= 40) return 'trending_creator'
  if (score >= 20) return 'creator'
  return 'newcomer'
}

// ── Main Scoring Function ───────────────────────────────────────────────────

export function scoreAccount(input: AccountScoreInput): AccountScoreOutput {
  const performance = computePerformanceScore(input)
  const engagement = computeEngagementScore(input)
  const growth = computeGrowthScore(input)
  const audience = computeAudienceScore(input.followers)
  const consistency = computeConsistencyScore(input.days_since_last_post)

  const raw =
    performance * 0.30 +
    engagement * 0.20 +
    growth * 0.20 +
    audience * 0.15 +
    consistency * 0.15

  const creator_score = round1(clamp(raw))
  const creator_rank = classifyCreatorRank(creator_score, performance, audience)

  return {
    creator_score,
    creator_rank,
    performance_score: round1(performance),
    engagement_score: round1(engagement),
    growth_score: round1(growth),
    audience_score: round1(audience),
    consistency_score: round1(consistency),
  }
}

// ── Rank Display Config ─────────────────────────────────────────────────────

export const CREATOR_RANK_CONFIG: Record<CreatorRank, { label: string; emoji: string; color: string }> = {
  newcomer:         { label: 'Newcomer',         emoji: '🌱', color: 'text-gray-400' },
  creator:          { label: 'Creator',           emoji: '🥉', color: 'text-[#CD7F32]' },
  trending_creator: { label: 'Trending Creator',  emoji: '🥈', color: 'text-[#C0C0C0]' },
  viral_creator:    { label: 'Viral Creator',     emoji: '🥇', color: 'text-[#FFD700]' },
  elite_creator:    { label: 'Elite Creator',     emoji: '💎', color: 'text-[#7DF9FF]' },
  legendary:        { label: 'Legendary',         emoji: '👑', color: 'text-[#FF4500]' },
  hidden_gem:       { label: 'Hidden Gem',        emoji: '🔥', color: 'text-[#FF6B35]' },
}
