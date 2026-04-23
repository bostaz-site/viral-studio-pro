/**
 * Unified clip scoring engine V2 -- used by both Twitch and Kick pipelines.
 * 7 factors: momentum, authority, engagement, recency, early signal, format, saturation.
 */

export interface ClipScoreInput {
  view_count: number
  like_count: number
  clip_age_hours: number
  clip_age_minutes: number
  velocity: number
  streamer_avg_views: number
  streamer_avg_velocity: number
  // V2 optional fields (backward-compatible)
  title?: string
  duration_seconds?: number
  snapshot_count?: number
  prev_velocity?: number
}

export type ClipRank = 'common' | 'rare' | 'super_rare' | 'epic' | 'legendary' | 'master'

export interface ClipScoreOutput {
  final_score: number
  momentum_score: number
  authority_score: number
  engagement_score: number
  recency_score: number
  early_signal_score: number
  format_score: number
  saturation_score: number
  rank: ClipRank
  /** @deprecated Use rank instead. Kept for DB column compatibility. */
  tier: string
  feed_category: 'hot_now' | 'early_gem' | 'proven' | 'normal'
}

// -- Factor 1: Momentum Dynamique (25%) --

function computeMomentumScore(input: ClipScoreInput): number {
  const { velocity, clip_age_hours, view_count, streamer_avg_velocity } = input
  const snapshotCount = input.snapshot_count ?? 1
  const prevVelocity = input.prev_velocity

  let rawMomentum: number

  if (snapshotCount >= 2 && prevVelocity != null) {
    // Real acceleration from snapshot delta
    const acceleration = velocity - prevVelocity
    const clampedAccel = Math.max(-velocity, Math.min(velocity, acceleration))
    rawMomentum = velocity * 0.7 + clampedAccel * 0.3
  } else {
    // Fallback: sublinear age decay (age^0.7 instead of linear)
    const effectiveAge = Math.max(0.1, Math.pow(clip_age_hours, 0.7))
    rawMomentum = view_count / effectiveAge
  }

  // Spike detection: 2x streamer avg velocity -> 1.5x boost
  if (streamer_avg_velocity > 0 && velocity > 2 * streamer_avg_velocity) {
    rawMomentum *= 1.5
  }

  // Normalize: log-scale, 20*log10(momentum)+30, capped 0-100
  const normalized = 20 * Math.log10(Math.max(1, rawMomentum)) + 30
  return clamp(normalized)
}

// -- Factor 2: Platform Authority (20%) --

function computeAuthorityScore(
  viewCount: number,
  streamerAvgViews: number
): number {
  if (streamerAvgViews <= 0) return 60 // Neutral when no data

  const ratio = viewCount / streamerAvgViews
  const percentileScore = clamp(ratio * 40)
  const volumeWeight = Math.log10(viewCount + 10)
  const raw = percentileScore * volumeWeight / 5
  return clamp(raw)
}

// -- Factor 3: Engagement Proxy (15%) --

function computeEngagementScore(
  viewCount: number,
  likeCount: number,
  title?: string
): number {
  let score: number

  if (likeCount === 0 && viewCount === 0) {
    score = 65 // Neutral-optimistic when no data
  } else if (viewCount > 0 && likeCount > 0) {
    const ratio = likeCount / viewCount
    if (ratio > 0.05) score = 100
    else if (ratio > 0.03) score = 75
    else if (ratio > 0.01) score = 50
    else score = ratio / 0.01 * 50
  } else if (viewCount > 0) {
    // Views but no like data -- assume decent engagement (Twitch clips typically do)
    score = 65
  } else {
    score = 65
  }

  // Title punctuation/caps boost (limited to +10% of current score)
  if (title) {
    let titleBoost = 0
    const exclamationCount = (title.match(/!/g) || []).length
    const questionCount = (title.match(/\?/g) || []).length
    if (exclamationCount >= 3) titleBoost += 3
    if (questionCount >= 2) titleBoost += 2
    const capsWords = title.split(/\s+/).filter(w => w.length >= 3 && w === w.toUpperCase())
    if (capsWords.length >= 2) titleBoost += 5

    score += Math.min(titleBoost, score * 0.1)
  }

  return clamp(score)
}

// -- Factor 4: Recency Decay (10%) --

function computeRecencyScore(ageHours: number): number {
  // Smooth exponential decay: e^(-age/72) * 100
  // <6h = 92, 24h = 72, 48h = 51, never 0
  return clamp(Math.exp(-ageHours / 72) * 100)
}

// -- Factor 5: Early Signal (10%) --

function computeEarlySignalScore(input: ClipScoreInput): number {
  const { view_count, clip_age_hours, clip_age_minutes, streamer_avg_views } = input
  const duration = input.duration_seconds ?? 30

  // If streamer avg unknown, neutral fallback
  if (streamer_avg_views === 0 && view_count < 10) return 60

  // Smooth decay instead of hard 2h cutoff: e^(-age/6)
  const decay = Math.exp(-clip_age_hours / 6)
  const viewsPerMinute = view_count / Math.max(1, clip_age_minutes)
  let raw = viewsPerMinute * Math.log(view_count + 1) * decay

  // Short clip bonus: < 20s favors TikTok loop
  if (duration < 20) raw *= 1.1

  // Normalize to 0-100 (scale: ~5 raw = 50, ~15 raw = 100)
  const normalized = Math.min(100, raw * 7)

  // Floor at 50 for clips older than 24h -- early signal is meaningless
  // for old clips, so use a neutral value instead of penalizing them
  if (clip_age_hours > 24 && normalized < 50) return 50

  return clamp(normalized)
}

// -- Factor 6: Format Score (10%) --

function computeFormatScore(durationSeconds?: number): number {
  const d = durationSeconds ?? 30
  if (d >= 15 && d <= 45) return 100
  if (d > 45 && d <= 60) return 80
  if (d >= 10 && d < 15) return 70
  if (d < 10) return 50
  return 50
}

// -- Factor 7: Saturation Penalty (-10%) --

function computeSaturationScore(input: ClipScoreInput): number {
  const { clip_age_hours, view_count, velocity, streamer_avg_velocity } = input

  let penalty = 0

  // Old viral clip: age > 7 days AND > 1M views
  if (clip_age_hours > 168 && view_count > 1_000_000) {
    const ageFactor = Math.min(1, (clip_age_hours - 168) / 336)
    const viewFactor = Math.min(1, view_count / 10_000_000)
    penalty += (ageFactor * 0.5 + viewFactor * 0.5) * 100
  }

  // Dead clip: current velocity < 50% of streamer avg even when recent
  if (streamer_avg_velocity > 0 && velocity < streamer_avg_velocity * 0.5 && view_count > 100) {
    const deadFactor = 1 - (velocity / (streamer_avg_velocity * 0.5))
    penalty += deadFactor * 40
  }

  return clamp(penalty)
}

// -- Rank classification --

function classifyRank(score: number): ClipRank {
  if (score >= 95) return 'master'
  if (score >= 80) return 'legendary'
  if (score >= 65) return 'epic'
  if (score >= 45) return 'super_rare'
  if (score >= 25) return 'rare'
  return 'common'
}

/** Map rank to the DB tier column value (backward compat) */
function rankToTier(rank: ClipRank): string {
  switch (rank) {
    case 'master': return 'mega_viral'
    case 'legendary': return 'viral'
    case 'epic': return 'hot'
    case 'super_rare': return 'rising'
    case 'rare': return 'normal'
    default: return 'dead'
  }
}

// -- Feed category (V2) --

function classifyFeedCategory(
  ageHours: number,
  earlySignalScore: number,
  momentumScore: number,
  authorityScore: number,
  finalScore: number
): ClipScoreOutput['feed_category'] {
  if (ageHours < 6 && (earlySignalScore >= 50 || authorityScore >= 70)) return 'early_gem'
  if (momentumScore >= 65 && ageHours < 12) return 'hot_now'
  if (finalScore >= 55 && ageHours > 12) return 'proven'
  return 'normal'
}

// -- Utility --

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// -- Main scoring function --

export function scoreClip(input: ClipScoreInput): ClipScoreOutput {
  const momentumScore = computeMomentumScore(input)
  const authorityScore = computeAuthorityScore(input.view_count, input.streamer_avg_views)
  const engagementScore = computeEngagementScore(input.view_count, input.like_count, input.title)
  const recencyScore = computeRecencyScore(input.clip_age_hours)
  const earlySignalScore = computeEarlySignalScore(input)
  const formatScore = computeFormatScore(input.duration_seconds)
  const saturationScore = computeSaturationScore(input)

  const rawScore =
    momentumScore * 0.25 +
    authorityScore * 0.20 +
    engagementScore * 0.15 +
    recencyScore * 0.10 +
    earlySignalScore * 0.10 +
    formatScore * 0.10 -
    saturationScore * 0.10

  // Display curve: stretch the effective 30-65 raw range into 40-95 display.
  // Formula: -5 + raw * 1.5 -- monotonic so ranking is preserved.
  // raw 30 = 40 | raw 40 = 55 | raw 50 = 70 | raw 60 = 85 | raw 67 = 95 | cap 95
  const displayScore = -5 + clamp(rawScore) * 1.5
  const finalScore = round1(Math.min(95.0, Math.max(0, displayScore)))

  return {
    final_score: finalScore,
    momentum_score: round1(momentumScore),
    authority_score: round1(authorityScore),
    engagement_score: round1(engagementScore),
    recency_score: round1(recencyScore),
    early_signal_score: round1(earlySignalScore),
    format_score: round1(formatScore),
    saturation_score: round1(saturationScore),
    rank: classifyRank(finalScore),
    tier: rankToTier(classifyRank(finalScore)),
    feed_category: classifyFeedCategory(
      input.clip_age_hours,
      earlySignalScore,
      momentumScore,
      authorityScore,
      finalScore
    ),
  }
}
