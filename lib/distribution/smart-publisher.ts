// Smart Publisher — the brain of the adaptive publishing system
// All decision logic is server-side so it can be reused across API routes

import { getPlatformRules } from './platform-rules'

// ============================================================
// Types
// ============================================================

export interface PublicationPerformance {
  id: string
  user_id: string
  scheduled_publication_id: string | null
  clip_id: string
  platform: string
  views_1h: number
  views_2h: number
  views_6h: number
  views_24h: number
  views_48h: number
  views_total: number
  likes: number
  comments: number
  shares: number
  watch_time_avg: number | null
  retention_rate: number | null
  posted_at: string
  day_of_week: number
  hour_of_day: number
  niche: string | null
  has_captions: boolean
  has_split_screen: boolean
  clip_duration_seconds: number | null
  performance_score: number | null
  is_viral: boolean
  velocity: number | null
  last_checked_at: string | null
  check_count: number
  created_at: string
  updated_at: string
}

export interface AccountIntelligence {
  id: string
  user_id: string
  platform: string
  phase: 'testing' | 'optimizing' | 'scaling'
  total_posts: number
  best_hours: TimeSlotScore[]
  worst_hours: TimeSlotScore[]
  optimal_posts_per_day: number | null
  optimal_min_hours_between: number | null
  best_clip_duration_range: { min: number; max: number } | null
  captions_boost_percent: number | null
  split_screen_boost_percent: number | null
  last_post_performance: string | null
  last_post_at: string | null
  consecutive_flops: number
  consecutive_hits: number
  current_momentum: 'rising' | 'neutral' | 'declining'
  hot_threshold: number
  viral_threshold: number
  flop_threshold: number
  updated_at: string
  created_at: string
}

export interface TimeSlotScore {
  hour: number
  day: number
  avg_score: number
}

export interface PublishRecommendation {
  should_post_now: boolean
  reason: string
  recommended_time: string | null
  wait_hours: number
  recommended_frequency: number
  confidence: 'low' | 'medium' | 'high'
  tips: string[]
}

// ============================================================
// Phase Detection
// ============================================================

export function detectPhase(totalPosts: number): 'testing' | 'optimizing' | 'scaling' {
  if (totalPosts < 15) return 'testing'
  if (totalPosts < 50) return 'optimizing'
  return 'scaling'
}

// ============================================================
// Performance Score Calculation
// ============================================================

export function calculatePerformanceScore(perf: PublicationPerformance): number {
  const weights = {
    velocity: 0.35,
    engagement: 0.25,
    retention: 0.20,
    volume: 0.20,
  }

  // Expected velocity baseline: 50 views/hour in the first 2 hours is "good"
  const expectedVelocity = 50

  // Velocity = views in first 2h / 2 (views per hour)
  const velocity = (perf.views_2h || 0) / 2
  const velocityScore = Math.min(100, (velocity / expectedVelocity) * 100)

  // Engagement: comments x3, shares x5 (weighted more)
  const totalEngagement = (perf.likes || 0) + (perf.comments || 0) * 3 + (perf.shares || 0) * 5
  const engagementRate = perf.views_total > 0 ? totalEngagement / perf.views_total : 0
  const engagementScore = Math.min(100, (engagementRate / 0.10) * 100)

  // Retention
  const retentionScore = (perf.retention_rate ?? 0.5) * 100

  // Volume (log scale so big accounts don't dominate)
  const volumeScore = Math.min(100, (Math.log10(Math.max(1, perf.views_total)) / 5) * 100)

  return (
    velocityScore * weights.velocity +
    engagementScore * weights.engagement +
    retentionScore * weights.retention +
    volumeScore * weights.volume
  )
}

// ============================================================
// Classify performance label
// ============================================================

export function classifyPerformance(
  score: number,
  intelligence: AccountIntelligence
): 'viral' | 'hot' | 'warm' | 'cold' | 'dead' {
  if (score >= intelligence.viral_threshold) return 'viral'
  if (score >= intelligence.hot_threshold) return 'hot'
  if (score >= intelligence.flop_threshold) return 'warm'
  if (score >= intelligence.flop_threshold * 0.5) return 'cold'
  return 'dead'
}

// ============================================================
// Analyze patterns from performances
// ============================================================

export interface AnalysisResult {
  bestHours: TimeSlotScore[]
  worstHours: TimeSlotScore[]
  bestDurationRange: { min: number; max: number } | null
  captionsBoost: number | null
  splitScreenBoost: number | null
  optimalPostsPerDay: number | null
  adjustedHotThreshold: number
  adjustedFlopThreshold: number
  momentum: 'rising' | 'neutral' | 'declining'
}

export function analyzePerformances(
  performances: PublicationPerformance[],
  platform: string
): AnalysisResult {
  const platformPerfs = performances.filter(p => p.platform === platform && p.performance_score != null)

  if (platformPerfs.length < 5) {
    return {
      bestHours: [],
      worstHours: [],
      bestDurationRange: null,
      captionsBoost: null,
      splitScreenBoost: null,
      optimalPostsPerDay: null,
      adjustedHotThreshold: 75,
      adjustedFlopThreshold: 25,
      momentum: 'neutral',
    }
  }

  // Group by hour-of-day and compute average scores
  const hourMap = new Map<number, { total: number; count: number; days: Set<number> }>()
  for (const p of platformPerfs) {
    const existing = hourMap.get(p.hour_of_day) ?? { total: 0, count: 0, days: new Set<number>() }
    existing.total += p.performance_score!
    existing.count += 1
    existing.days.add(p.day_of_week)
    hourMap.set(p.hour_of_day, existing)
  }

  const hourScores: TimeSlotScore[] = []
  for (const [hour, data] of hourMap) {
    // Pick most common day for this hour
    const dayArr = Array.from(data.days)
    hourScores.push({ hour, day: dayArr[0], avg_score: data.total / data.count })
  }
  hourScores.sort((a, b) => b.avg_score - a.avg_score)

  const bestHours = hourScores.slice(0, 3)
  const worstHours = hourScores.slice(-3).reverse()

  // Best clip duration
  let bestDurationRange: { min: number; max: number } | null = null
  const durPerfs = platformPerfs.filter(p => p.clip_duration_seconds != null)
  if (durPerfs.length >= 5) {
    const sorted = durPerfs.sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))
    const topQuarter = sorted.slice(0, Math.ceil(sorted.length / 4))
    const durations = topQuarter.map(p => p.clip_duration_seconds!)
    bestDurationRange = {
      min: Math.floor(Math.min(...durations)),
      max: Math.ceil(Math.max(...durations)),
    }
  }

  // Captions boost
  let captionsBoost: number | null = null
  const withCaptions = platformPerfs.filter(p => p.has_captions)
  const withoutCaptions = platformPerfs.filter(p => !p.has_captions)
  if (withCaptions.length >= 3 && withoutCaptions.length >= 3) {
    const avgWith = withCaptions.reduce((s, p) => s + (p.performance_score ?? 0), 0) / withCaptions.length
    const avgWithout = withoutCaptions.reduce((s, p) => s + (p.performance_score ?? 0), 0) / withoutCaptions.length
    if (avgWithout > 0) {
      captionsBoost = Math.round(((avgWith - avgWithout) / avgWithout) * 100)
    }
  }

  // Split screen boost
  let splitScreenBoost: number | null = null
  const withSplit = platformPerfs.filter(p => p.has_split_screen)
  const withoutSplit = platformPerfs.filter(p => !p.has_split_screen)
  if (withSplit.length >= 3 && withoutSplit.length >= 3) {
    const avgWith = withSplit.reduce((s, p) => s + (p.performance_score ?? 0), 0) / withSplit.length
    const avgWithout = withoutSplit.reduce((s, p) => s + (p.performance_score ?? 0), 0) / withoutSplit.length
    if (avgWithout > 0) {
      splitScreenBoost = Math.round(((avgWith - avgWithout) / avgWithout) * 100)
    }
  }

  // Optimal posts per day — look at days with multiple posts and find the best count
  const dayPostMap = new Map<string, number[]>()
  for (const p of platformPerfs) {
    const dateKey = p.posted_at.slice(0, 10)
    const existing = dayPostMap.get(dateKey) ?? []
    existing.push(p.performance_score ?? 0)
    dayPostMap.set(dateKey, existing)
  }
  let optimalPostsPerDay: number | null = null
  if (dayPostMap.size >= 5) {
    const countAvg = new Map<number, { total: number; count: number }>()
    for (const scores of dayPostMap.values()) {
      const postsCount = scores.length
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length
      const existing = countAvg.get(postsCount) ?? { total: 0, count: 0 }
      existing.total += avg
      existing.count += 1
      countAvg.set(postsCount, existing)
    }
    let bestAvg = 0
    for (const [count, data] of countAvg) {
      const avg = data.total / data.count
      if (avg > bestAvg) {
        bestAvg = avg
        optimalPostsPerDay = count
      }
    }
  }

  // Adjust thresholds based on actual data distribution
  const allScores = platformPerfs.map(p => p.performance_score!).sort((a, b) => a - b)
  const p25 = allScores[Math.floor(allScores.length * 0.25)]
  const p75 = allScores[Math.floor(allScores.length * 0.75)]
  const adjustedHotThreshold = Math.round(p75)
  const adjustedFlopThreshold = Math.round(p25)

  // Momentum: compare last 5 posts vs previous 5
  const momentum = computeMomentum(platformPerfs)

  return {
    bestHours,
    worstHours,
    bestDurationRange,
    captionsBoost,
    splitScreenBoost,
    optimalPostsPerDay,
    adjustedHotThreshold,
    adjustedFlopThreshold,
    momentum,
  }
}

function computeMomentum(
  perfs: PublicationPerformance[]
): 'rising' | 'neutral' | 'declining' {
  const sorted = [...perfs].sort(
    (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
  )
  if (sorted.length < 10) return 'neutral'

  const recent5 = sorted.slice(0, 5)
  const prev5 = sorted.slice(5, 10)

  const avgRecent = recent5.reduce((s, p) => s + (p.performance_score ?? 0), 0) / 5
  const avgPrev = prev5.reduce((s, p) => s + (p.performance_score ?? 0), 0) / 5

  const diff = avgRecent - avgPrev
  if (diff > 10) return 'rising'
  if (diff < -10) return 'declining'
  return 'neutral'
}

// ============================================================
// Recommendation Engine
// ============================================================

export function getPublishRecommendation(
  intelligence: AccountIntelligence | null,
  performances: PublicationPerformance[],
  platform: string,
  currentTime: Date = new Date()
): PublishRecommendation {
  const rules = getPlatformRules(platform)

  // No intelligence yet — default recommendations
  if (!intelligence) {
    return {
      should_post_now: true,
      reason: 'No data yet — start posting to build intelligence.',
      recommended_time: null,
      wait_hours: 0,
      recommended_frequency: rules.optimal_posts_per_day,
      confidence: 'low',
      tips: [
        'Post at different times to discover your best slots.',
        'Try both with and without captions to see what works.',
      ],
    }
  }

  const phase = intelligence.phase
  const tips: string[] = []
  let shouldPost = true
  let reason = ''
  let waitHours = 0
  let recommendedTime: Date | null = null

  // Hours since last post
  const hoursSinceLastPost = intelligence.last_post_at
    ? (currentTime.getTime() - new Date(intelligence.last_post_at).getTime()) / (1000 * 60 * 60)
    : Infinity

  // Count posts today
  const todayStart = new Date(currentTime)
  todayStart.setHours(0, 0, 0, 0)
  const postsToday = performances.filter(
    p => p.platform === platform && new Date(p.posted_at) >= todayStart
  ).length

  // ---- PHASE: TESTING ----
  if (phase === 'testing') {
    const maxTestPostsPerDay = 4

    if (postsToday >= maxTestPostsPerDay) {
      shouldPost = false
      reason = 'You\'ve reached the testing limit for today. Rest and post again tomorrow.'
      waitHours = getHoursUntilTomorrow(currentTime, 10)
      recommendedTime = addHours(currentTime, waitHours)
    } else if (hoursSinceLastPost < rules.min_hours_between_posts) {
      shouldPost = false
      waitHours = rules.min_hours_between_posts - hoursSinceLastPost
      reason = `Wait ${Math.ceil(waitHours)}h before posting again (minimum spacing).`
      recommendedTime = addHours(currentTime, waitHours)
    } else {
      reason = 'Testing phase — good to post now. Vary your posting times!'
    }

    tips.push(`Post ${intelligence.total_posts}/15 — ${15 - intelligence.total_posts} more to unlock pattern analysis.`)
    tips.push('Try morning (10-12h), afternoon (15-17h), and evening (19-23h) slots.')
    return buildRecommendation(shouldPost, reason, recommendedTime, waitHours, maxTestPostsPerDay, 'low', tips)
  }

  // ---- PHASE: OPTIMIZING ----
  if (phase === 'optimizing') {
    const recommendedFreq = intelligence.optimal_posts_per_day ?? rules.optimal_posts_per_day

    if (postsToday >= recommendedFreq) {
      shouldPost = false
      reason = 'You\'ve hit your optimal post count for today.'
      waitHours = getHoursUntilTomorrow(currentTime, getBestHour(intelligence, platform))
      recommendedTime = addHours(currentTime, waitHours)
    } else if (hoursSinceLastPost < (intelligence.optimal_min_hours_between ?? rules.min_hours_between_posts)) {
      const minSpacing = intelligence.optimal_min_hours_between ?? rules.min_hours_between_posts
      shouldPost = false
      waitHours = minSpacing - hoursSinceLastPost
      reason = `Wait ${Math.ceil(waitHours)}h — optimized spacing for your account.`
      recommendedTime = addHours(currentTime, waitHours)
    } else {
      // Check if current hour is a good slot
      const currentHour = currentTime.getHours()
      const isGoodSlot = intelligence.best_hours.some(h => Math.abs(h.hour - currentHour) <= 1)
      if (isGoodSlot) {
        reason = 'Great timing — this is one of your best performing slots!'
      } else {
        reason = 'OK to post now, but your best hours are: ' +
          intelligence.best_hours.slice(0, 2).map(h => `${h.hour}h`).join(', ')
      }
    }

    tips.push(`Analyzing ${intelligence.total_posts}/50 posts — ${50 - intelligence.total_posts} more to unlock full scaling.`)
    if (intelligence.captions_boost_percent != null && intelligence.captions_boost_percent > 0) {
      tips.push(`Captions boost your performance by +${intelligence.captions_boost_percent}%.`)
    }
    return buildRecommendation(shouldPost, reason, recommendedTime, waitHours, recommendedFreq, 'medium', tips)
  }

  // ---- PHASE: SCALING ----
  const recommendedFreq = intelligence.optimal_posts_per_day ?? rules.optimal_posts_per_day
  const lastPerf = intelligence.last_post_performance

  // Recovery mode: 3+ consecutive flops
  if (intelligence.consecutive_flops >= 3) {
    if (postsToday >= 1) {
      shouldPost = false
      reason = 'Recovery mode — your last 3 posts underperformed. Quality > quantity today.'
      waitHours = getHoursUntilTomorrow(currentTime, getBestHour(intelligence, platform))
      recommendedTime = addHours(currentTime, waitHours)
    } else if (hoursSinceLastPost < 12) {
      shouldPost = false
      waitHours = 12 - hoursSinceLastPost
      reason = 'Recovery mode — spacing posts further to reset algorithm signals.'
      recommendedTime = addHours(currentTime, waitHours)
    } else {
      reason = 'Recovery mode — post your best content now. Make it count!'
    }
    tips.push('Switch up your content style — try a different type of clip.')
    tips.push('Recovery mode: 1 post/day for 2 days to reset.')
    return buildRecommendation(shouldPost, reason, recommendedTime, waitHours, 1, 'high', tips)
  }

  // Viral: last post exploded
  if (lastPerf === 'viral') {
    if (hoursSinceLastPost < rules.viral_cooldown_hours) {
      shouldPost = false
      waitHours = rules.viral_cooldown_hours - hoursSinceLastPost
      reason = `Your last clip is going viral! Let the algorithm maximize its reach (wait ${Math.ceil(waitHours)}h).`
      recommendedTime = addHours(currentTime, waitHours)
      tips.push('Don\'t interrupt a viral clip — the algorithm is still pushing it.')
      tips.push('Your next post will benefit from the momentum.')
      return buildRecommendation(shouldPost, reason, recommendedTime, waitHours, recommendedFreq, 'high', tips)
    }
  }

  // Hot: last post performing well
  if (lastPerf === 'hot') {
    const cooldown = rules.algo_push_duration_hours
    if (hoursSinceLastPost < cooldown) {
      shouldPost = false
      waitHours = cooldown - hoursSinceLastPost
      reason = `Your last clip is performing well! Wait ${Math.ceil(waitHours)}h for the algorithm to finish pushing it.`
      recommendedTime = addHours(currentTime, waitHours)
      tips.push('Hot streak — your next post will benefit from the momentum.')
      return buildRecommendation(shouldPost, reason, recommendedTime, waitHours, recommendedFreq, 'high', tips)
    }
  }

  // Flop: last post underperformed
  if (lastPerf === 'cold' || lastPerf === 'dead') {
    const flopSpacing = rules.flop_recovery_hours
    if (hoursSinceLastPost < flopSpacing) {
      shouldPost = false
      waitHours = flopSpacing - hoursSinceLastPost
      reason = `Last post underperformed. Wait ${Math.ceil(waitHours)}h before retrying.`
      recommendedTime = addHours(currentTime, waitHours)
    } else {
      reason = 'Enough time has passed since your last post. Try different content!'
    }
    tips.push('Switch to a different type of clip for variety.')
  }

  // Normal flow checks
  if (shouldPost) {
    if (postsToday >= rules.max_safe_posts_per_day) {
      shouldPost = false
      reason = `Maximum safe posts reached for ${rules.name} today.`
      waitHours = getHoursUntilTomorrow(currentTime, getBestHour(intelligence, platform))
      recommendedTime = addHours(currentTime, waitHours)
    } else if (hoursSinceLastPost < (intelligence.optimal_min_hours_between ?? rules.min_hours_between_posts)) {
      shouldPost = false
      const minSpacing = intelligence.optimal_min_hours_between ?? rules.min_hours_between_posts
      waitHours = minSpacing - hoursSinceLastPost
      reason = `Wait ${Math.ceil(waitHours)}h for optimal spacing.`
      recommendedTime = addHours(currentTime, waitHours)
    } else {
      reason = reason || 'Good to post now — timing looks right!'
    }
  }

  // Momentum tips
  if (intelligence.current_momentum === 'rising') {
    tips.push('Your account is on a rising streak — maintain your current rhythm.')
  } else if (intelligence.current_momentum === 'declining') {
    tips.push('Momentum is declining — focus on quality over quantity.')
  }

  return buildRecommendation(shouldPost, reason, recommendedTime, waitHours, recommendedFreq, 'high', tips)
}

// ============================================================
// Timing evaluation for queue items
// ============================================================

export type TimingQuality = 'great' | 'ok' | 'poor'

export function evaluateTimingQuality(
  scheduledHour: number,
  intelligence: AccountIntelligence | null,
  platform: string
): TimingQuality {
  const rules = getPlatformRules(platform)

  const goodHours = intelligence?.best_hours.length
    ? intelligence.best_hours.map(h => h.hour)
    : rules.default_optimal_hours

  const badHours = intelligence?.worst_hours.length
    ? intelligence.worst_hours.map(h => h.hour)
    : []

  // Check if within ±1 hour of a good slot
  if (goodHours.some(h => Math.abs(h - scheduledHour) <= 1)) return 'great'
  if (badHours.some(h => Math.abs(h - scheduledHour) <= 1)) return 'poor'
  return 'ok'
}

// ============================================================
// Helpers
// ============================================================

function buildRecommendation(
  shouldPost: boolean,
  reason: string,
  recommendedTime: Date | null,
  waitHours: number,
  recommendedFrequency: number,
  confidence: 'low' | 'medium' | 'high',
  tips: string[]
): PublishRecommendation {
  return {
    should_post_now: shouldPost,
    reason,
    recommended_time: recommendedTime ? recommendedTime.toISOString() : null,
    wait_hours: Math.max(0, Math.round(waitHours * 10) / 10),
    recommended_frequency: recommendedFrequency,
    confidence,
    tips,
  }
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function getHoursUntilTomorrow(current: Date, targetHour: number): number {
  const tomorrow = new Date(current)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(targetHour, 0, 0, 0)
  return (tomorrow.getTime() - current.getTime()) / (1000 * 60 * 60)
}

function getBestHour(intelligence: AccountIntelligence, platform: string): number {
  if (intelligence.best_hours.length > 0) {
    return intelligence.best_hours[0].hour
  }
  const rules = getPlatformRules(platform)
  return rules.default_optimal_hours[0] ?? 12
}
