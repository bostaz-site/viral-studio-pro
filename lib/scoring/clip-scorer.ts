/**
 * Unified clip scoring engine — used by both Twitch and Kick pipelines.
 * 5 factors: velocity, viral ratio, recency, early signal, anomaly detection.
 */

export interface ClipScoreInput {
  view_count: number
  like_count: number
  clip_age_hours: number
  clip_age_minutes: number
  velocity: number
  streamer_avg_views: number
  streamer_avg_velocity: number
}

export interface ClipScoreOutput {
  final_score: number
  velocity_score: number
  viral_ratio_score: number
  recency_score: number
  early_signal_score: number
  anomaly_score: number
  tier: 'mega_viral' | 'viral' | 'hot' | 'rising' | 'normal' | 'dead'
  feed_category: 'hot_now' | 'early_gem' | 'proven' | 'normal'
}

// ── Factor 1: Velocity Score (35%) ─────────────────────────────────────────

function computeVelocityScore(velocity: number): number {
  const raw = 15 * Math.log10(Math.max(1, velocity)) + 10
  return Math.min(100, Math.max(0, raw))
}

// ── Factor 2: Viral Ratio (20%) ────────────────────────────────────────────

function computeViralRatioScore(velocity: number, viewCount: number): number {
  const viralRatio = velocity / (viewCount + 1)
  return Math.min(100, viralRatio * 10000)
}

// ── Factor 3: Recency Boost (15%) ──────────────────────────────────────────

function computeRecencyScore(ageHours: number): number {
  if (ageHours < 2) return 100
  if (ageHours <= 6) return 80 - ((ageHours - 2) / 4) * 30
  if (ageHours <= 24) return 50 - ((ageHours - 6) / 18) * 30
  if (ageHours <= 48) return 20 - ((ageHours - 24) / 24) * 20
  return 0
}

// ── Factor 4: Early Signal (15%) ───────────────────────────────────────────

function computeEarlySignalScore(
  viewCount: number,
  likeCount: number,
  ageMinutes: number
): number {
  if (ageMinutes >= 120) return 0

  const viewsPerMinute = viewCount / Math.max(1, ageMinutes)
  let earlySignal = Math.min(100, viewsPerMinute * 50)

  // Boost for high like-to-view ratio
  if (likeCount > 0 && viewCount > 0) {
    const likeRatio = likeCount / viewCount
    if (likeRatio > 0.15) earlySignal *= 1.5
    else if (likeRatio > 0.10) earlySignal *= 1.3
  }

  return Math.min(100, Math.max(0, earlySignal))
}

// ── Factor 5: Anomaly Score (15%) ──────────────────────────────────────────

function computeAnomalyScore(
  viewCount: number,
  velocity: number,
  streamerAvgViews: number,
  streamerAvgVelocity: number
): number {
  if (streamerAvgViews <= 0) return 50 // Not enough data, neutral

  const viewRatio = viewCount / streamerAvgViews
  const velocityRatio = velocity / Math.max(1, streamerAvgVelocity)

  const anomaly = (viewRatio - 1) * 30 + (velocityRatio - 1) * 40
  return Math.min(100, Math.max(0, anomaly))
}

// ── Tier classification ────────────────────────────────────────────────────

function classifyTier(score: number): ClipScoreOutput['tier'] {
  if (score >= 90) return 'mega_viral'
  if (score >= 75) return 'viral'
  if (score >= 60) return 'hot'
  if (score >= 40) return 'rising'
  if (score >= 15) return 'normal'
  return 'dead'
}

// ── Feed category ──────────────────────────────────────────────────────────

function classifyFeedCategory(
  ageHours: number,
  earlySignalScore: number,
  velocityScore: number,
  finalScore: number
): ClipScoreOutput['feed_category'] {
  if (ageHours < 2 && earlySignalScore >= 60) return 'early_gem'
  if (velocityScore >= 70 && ageHours < 6) return 'hot_now'
  if (finalScore >= 60 && ageHours > 6) return 'proven'
  return 'normal'
}

// ── Main scoring function ──────────────────────────────────────────────────

export function scoreClip(input: ClipScoreInput): ClipScoreOutput {
  const velocityScore = computeVelocityScore(input.velocity)
  const viralRatioScore = computeViralRatioScore(input.velocity, input.view_count)
  const recencyScore = computeRecencyScore(input.clip_age_hours)
  const earlySignalScore = computeEarlySignalScore(
    input.view_count,
    input.like_count,
    input.clip_age_minutes
  )
  const anomalyScore = computeAnomalyScore(
    input.view_count,
    input.velocity,
    input.streamer_avg_views,
    input.streamer_avg_velocity
  )

  const finalScore = Math.min(100, Math.max(0,
    velocityScore * 0.35 +
    viralRatioScore * 0.20 +
    recencyScore * 0.15 +
    earlySignalScore * 0.15 +
    anomalyScore * 0.15
  ))

  const roundedScore = Math.round(finalScore * 10) / 10

  return {
    final_score: roundedScore,
    velocity_score: Math.round(velocityScore * 10) / 10,
    viral_ratio_score: Math.round(viralRatioScore * 10) / 10,
    recency_score: Math.round(recencyScore * 10) / 10,
    early_signal_score: Math.round(earlySignalScore * 10) / 10,
    anomaly_score: Math.round(anomalyScore * 10) / 10,
    tier: classifyTier(roundedScore),
    feed_category: classifyFeedCategory(
      input.clip_age_hours,
      earlySignalScore,
      velocityScore,
      roundedScore
    ),
  }
}
