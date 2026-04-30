/**
 * Momentum Scoring Engine — measures real-time creator activity.
 * Separate from Creator Rank (YouTube-based, stable).
 * Momentum is fast, dynamic, and designed to create urgency.
 *
 * 3 factors + decay:
 * - Activity (40%): clips published x avg quality this week
 * - Quality (35%): avg clip score + trend bonus
 * - Consistency (25%): streak days (continuous) + milestone bonuses
 * - Decay: -8 pts/day after 48h of inactivity
 */

export type MomentumTier = 'dormant' | 'warming_up' | 'building' | 'on_fire' | 'unstoppable'

export interface MomentumInput {
  weeklyClipsCount: number
  weeklyAvgScore: number
  globalAvgScore: number
  bestClipScore: number
  last3AvgScore: number
  currentStreak: number
  hoursSinceLastPublish: number
  platformCount: number
}

export interface MomentumOutput {
  score: number
  tier: MomentumTier
  tierLabel: string
  tierEmoji: string
  activityScore: number
  qualityScore: number
  consistencyScore: number
  decayAmount: number
  decayWarning: string | null
  nextTierAt: number | null
  nextTierLabel: string | null
  actionHint: string
}

export const MOMENTUM_TIERS: Array<{
  tier: MomentumTier
  min: number
  label: string
  emoji: string
}> = [
  { tier: 'unstoppable', min: 81, label: 'Unstoppable', emoji: '\uD83D\uDC51' },
  { tier: 'on_fire', min: 61, label: 'On Fire', emoji: '\uD83D\uDD25' },
  { tier: 'building', min: 41, label: 'Building', emoji: '\u26A1' },
  { tier: 'warming_up', min: 21, label: 'Warming Up', emoji: '\uD83C\uDF24\uFE0F' },
  { tier: 'dormant', min: 0, label: 'Dormant', emoji: '\uD83D\uDCA4' },
]

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v))
}

// ── Factor 1: Activity (40%) ──
// clips x avgQuality, normalized to optimal pace (5 clips/week at score 70)
function computeActivity(input: MomentumInput): number {
  const { weeklyClipsCount, weeklyAvgScore } = input
  if (weeklyClipsCount === 0) return 0
  const qualityWeighted = weeklyClipsCount * (weeklyAvgScore / 70)
  const optimal = 5
  return clamp(Math.round((qualityWeighted / optimal) * 100))
}

// ── Factor 2: Quality (35%) ──
// Base: avgScore x 0.7 + bestScore x 0.3
// Trend bonus: if last 3 clips > global avg -> boost
function computeQuality(input: MomentumInput): number {
  const { globalAvgScore, bestClipScore, last3AvgScore } = input
  const base = globalAvgScore * 0.7 + bestClipScore * 0.3
  const trend = last3AvgScore - globalAvgScore
  const trendBonus = trend * 0.2
  return clamp(Math.round(base + trendBonus))
}

// ── Factor 3: Consistency (25%) ──
// Continuous: streak x 5 (cap 100)
// Milestone bonuses: 7 days = +10, 14 days = +15
function computeConsistency(input: MomentumInput): number {
  const { currentStreak } = input
  let score = Math.min(100, currentStreak * 5)
  if (currentStreak >= 7) score = Math.min(100, score + 10)
  if (currentStreak >= 14) score = Math.min(100, score + 15)
  return Math.round(score)
}

// ── Decay: after 48h of no posting, lose 8 pts per 24h ──
function computeDecay(input: MomentumInput): {
  decayAmount: number
  decayWarning: string | null
} {
  const { hoursSinceLastPublish } = input
  if (hoursSinceLastPublish <= 48) {
    if (hoursSinceLastPublish >= 36) {
      const hoursLeft = Math.round(48 - hoursSinceLastPublish)
      return { decayAmount: 0, decayWarning: `Momentum drops in ${hoursLeft}h \u2014 post to keep it` }
    }
    return { decayAmount: 0, decayWarning: null }
  }
  const decayDays = (hoursSinceLastPublish - 48) / 24
  const decayAmount = Math.round(decayDays * 8)
  return {
    decayAmount,
    decayWarning: `Dropping -${Math.min(decayAmount, 8)} per day \u2014 post now to recover`,
  }
}

function getTier(score: number): { tier: MomentumTier; label: string; emoji: string } {
  for (const t of MOMENTUM_TIERS) {
    if (score >= t.min) return t
  }
  return MOMENTUM_TIERS[MOMENTUM_TIERS.length - 1]
}

function getNextTier(score: number): {
  nextTierAt: number | null
  nextTierLabel: string | null
} {
  for (let i = MOMENTUM_TIERS.length - 1; i >= 0; i--) {
    if (MOMENTUM_TIERS[i].min > score) {
      return { nextTierAt: MOMENTUM_TIERS[i].min, nextTierLabel: MOMENTUM_TIERS[i].label }
    }
  }
  return { nextTierAt: null, nextTierLabel: null }
}

function getActionHint(
  score: number,
  input: MomentumInput,
  nextTierLabel: string | null,
  nextTierAt: number | null,
): string {
  if (nextTierAt === null) return 'You\'re at max momentum \u2014 keep dominating'
  const gap = nextTierAt - score
  if (gap <= 5) return `Post 1 high-score clip to reach ${nextTierLabel}`
  if (gap <= 15) return `${Math.ceil(gap / 8)} more quality clips to hit ${nextTierLabel}`
  if (input.hoursSinceLastPublish > 36) return 'Post now before your momentum starts dropping'
  if (input.weeklyClipsCount === 0) return 'Post your first clip this week to start building'
  return `Keep posting \u2014 ${nextTierLabel} is within reach`
}

// ── Main scorer ──

export function scoreMomentum(input: MomentumInput): MomentumOutput {
  const activityScore = computeActivity(input)
  const qualityScore = computeQuality(input)
  const consistencyScore = computeConsistency(input)
  const { decayAmount, decayWarning } = computeDecay(input)

  const rawScore = Math.round(
    activityScore * 0.40 +
    qualityScore * 0.35 +
    consistencyScore * 0.25
  )

  const score = clamp(rawScore - decayAmount)
  const { tier, label: tierLabel, emoji: tierEmoji } = getTier(score)
  const { nextTierAt, nextTierLabel } = getNextTier(score)
  const actionHint = getActionHint(score, input, nextTierLabel, nextTierAt)

  return {
    score,
    tier,
    tierLabel,
    tierEmoji,
    activityScore,
    qualityScore,
    consistencyScore,
    decayAmount,
    decayWarning,
    nextTierAt,
    nextTierLabel,
    actionHint,
  }
}
