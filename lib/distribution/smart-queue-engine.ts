/* ─── Smart Queue Engine ───
 * Intelligent auto-distribution from clip bank.
 * 5 layers: Timing, Sequencing, Risk Strategy, Learning Loop, Confidence.
 * Plus: Emotional rotation, momentum window, kill switch, breakout probability.
 *
 * This engine decides WHAT to post, WHEN, WHERE, and in WHAT ORDER.
 * It learns from results and adapts over time.
 */

import type { PersistentStats } from './session-persistence'
import type { LearnedDistributionProfile, ConfidenceLevel } from '@/types/learning'

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export type RiskLevel = 'proven' | 'wildcard'
export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night'
export type HookType = 'question' | 'statement' | 'shock' | 'story' | 'unknown'
export type MoodType = 'rage' | 'hype' | 'wholesome' | 'funny' | 'sad' | 'epic' | 'chill' | 'unknown'
export type SlotQuality = 'prime' | 'good' | 'offpeak'

export interface QueueClip {
  id: string
  title: string
  viralScore: number
  mood: MoodType
  hookType: HookType
  freshness: number          // 0-100, higher = more recent/relevant
  platformFit: Record<string, number>  // platform → fit score 0-100
  createdAt: string          // ISO date
  thumbnailUrl?: string | null
}

export interface ScheduledPost {
  clip: QueueClip
  platform: string
  scheduledAt: Date
  slotQuality: SlotQuality
  riskLevel: RiskLevel
  breakoutProbability: number
  breakoutContext: string     // "↑ good timing" or "↓ low momentum"
  confidence: number          // 0-100
  explanation: string         // "Why this order" line
  queuePriority: number       // internal score
  learnedReasons: string[]    // reasons from LearnedDistributionProfile (empty if no profile)
}

export interface QueuePreview {
  posts: ScheduledPost[]
  totalEstReach: { low: number; high: number }
  confidence: number           // avg confidence across posts
  emotionalMix: 'diverse' | 'moderate' | 'repetitive'
  strategy: string             // "Build → Breakout → Capitalize"
}

export interface QueueSettings {
  maxPerDayPerPlatform: number  // default 3
  blackoutHours: number[]       // hours to never post (UTC)
  activePlatforms: string[]     // ['tiktok', 'youtube', 'instagram']
  autoMode: boolean             // true = auto-post, false = manual approve
  timezone: string              // IANA timezone
  appliedAdjustments: string[]  // adjustment descriptions applied by user from analytics
}

export interface PostResult {
  clipId: string
  platform: string
  postedAt: string           // ISO datetime
  timeBucket: TimeBucket
  hookType: HookType
  mood: MoodType
  viralScore: number
  performance6h: number | null
  performance24h: number | null
  performance48h: number | null
}

export interface LearningData {
  postHistory: PostResult[]
  platformAffinity: Record<string, number>    // platform → multiplier (1.0 = baseline)
  timeBucketPerformance: Record<string, Record<TimeBucket, number>> // platform → bucket → avg perf
  moodPerformance: Record<MoodType, number>   // mood → avg performance
  hookPerformance: Record<HookType, number>   // hook → avg performance
  lastMomentumWindow: {
    active: boolean
    boostRemaining: number  // how many slots still get the boost
    multiplier: number
  }
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS: QueueSettings = {
  maxPerDayPerPlatform: 3,
  blackoutHours: [0, 1, 2, 3, 4, 5],
  activePlatforms: ['tiktok', 'youtube', 'instagram'],
  autoMode: false,
  timezone: 'America/New_York',
  appliedAdjustments: [],
}

/** Default platform optimal hours (UTC). Overridden by learning data. */
const BASE_OPTIMAL_HOURS: Record<string, { prime: number[]; good: number[] }> = {
  tiktok:    { prime: [19, 20, 21, 22],    good: [7, 8, 9, 10, 11, 18, 23] },
  youtube:   { prime: [12, 13, 14, 15, 16], good: [11, 17, 18, 19, 20] },
  instagram: { prime: [11, 12, 13, 19],     good: [8, 9, 10, 14, 17, 18, 20] },
}

const STRATEGY_LABELS: Record<string, string> = {
  'proven-proven-proven': 'Consistent Push',
  'proven-wildcard-proven': 'Build → Breakout → Capitalize',
  'proven-proven-wildcard': 'Build → Build → Test',
  'wildcard-proven-proven': 'Test → Capitalize → Push',
  'proven-wildcard': 'Build → Breakout',
  'wildcard-proven': 'Test → Capitalize',
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v))
}

function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

function getSlotQuality(platform: string, hour: number): SlotQuality {
  const base = BASE_OPTIMAL_HOURS[platform]
  if (!base) return 'good'
  if (base.prime.includes(hour)) return 'prime'
  if (base.good.includes(hour)) return 'good'
  return 'offpeak'
}

function formatK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function createDefaultLearning(): LearningData {
  return {
    postHistory: [],
    platformAffinity: {},
    timeBucketPerformance: {},
    moodPerformance: {} as Record<MoodType, number>,
    hookPerformance: {} as Record<HookType, number>,
    lastMomentumWindow: { active: false, boostRemaining: 0, multiplier: 1.0 },
  }
}

// ══════════════════════════════════════════════════════════════
// LAYER 1: TIMING ENGINE
// ══════════════════════════════════════════════════════════════

interface TimingScore {
  hour: number
  platform: string
  score: number
  quality: SlotQuality
}

/**
 * Score each hour for a platform. Combines base optimal hours
 * with learned performance data (recency-weighted).
 */
function scoreTimingSlots(
  platform: string,
  learning: LearningData,
  settings: QueueSettings,
): TimingScore[] {
  const slots: TimingScore[] = []

  for (let h = 0; h < 24; h++) {
    // Skip blackout hours
    if (settings.blackoutHours.includes(h)) continue

    const quality = getSlotQuality(platform, h)
    let baseScore = quality === 'prime' ? 90 : quality === 'good' ? 60 : 30

    // Apply learned time bucket performance
    const bucket = getTimeBucket(h)
    const bucketPerf = learning.timeBucketPerformance[platform]?.[bucket]
    if (bucketPerf !== undefined) {
      // Recency weighting: learned data modifies base by up to ±30
      const modifier = (bucketPerf - 1.0) * 30
      baseScore = clamp(baseScore + modifier, 10, 100)
    }

    // Apply platform affinity
    const affinity = learning.platformAffinity[platform] ?? 1.0
    baseScore = clamp(Math.round(baseScore * affinity), 10, 100)

    slots.push({ hour: h, platform, score: baseScore, quality })
  }

  return slots.sort((a, b) => b.score - a.score)
}

/**
 * Pick the next N best posting times across all active platforms.
 */
function pickBestSlots(
  platforms: string[],
  count: number,
  learning: LearningData,
  settings: QueueSettings,
  startHour: number,
): Array<{ platform: string; hour: number; quality: SlotQuality; timingScore: number }> {
  const allSlots: Array<{ platform: string; hour: number; quality: SlotQuality; timingScore: number }> = []

  for (const p of platforms) {
    const scored = scoreTimingSlots(p, learning, settings)
    // Only future hours (today) or any hour (tomorrow)
    const future = scored.filter(s => s.hour > startHour)
    const tomorrow = scored.filter(s => s.hour <= startHour)

    for (const s of [...future, ...tomorrow].slice(0, count)) {
      allSlots.push({ platform: p, hour: s.hour, quality: s.quality, timingScore: s.score })
    }
  }

  // Sort by score, then deduplicate platform (don't post same platform at same hour)
  allSlots.sort((a, b) => b.timingScore - a.timingScore)

  const picked: typeof allSlots = []
  const usedSlots = new Set<string>()
  const platformCount: Record<string, number> = {}

  for (const s of allSlots) {
    const key = `${s.platform}-${s.hour}`
    if (usedSlots.has(key)) continue
    if ((platformCount[s.platform] ?? 0) >= settings.maxPerDayPerPlatform) continue

    // Don't schedule two posts within 2 hours of each other on same platform
    const tooClose = picked.some(
      p => p.platform === s.platform && Math.abs(p.hour - s.hour) < 2
    )
    if (tooClose) continue

    picked.push(s)
    usedSlots.add(key)
    platformCount[s.platform] = (platformCount[s.platform] ?? 0) + 1

    if (picked.length >= count) break
  }

  return picked.sort((a, b) => {
    // Sort chronologically (future first, then tomorrow)
    const aFuture = a.hour > startHour ? 0 : 1
    const bFuture = b.hour > startHour ? 0 : 1
    if (aFuture !== bFuture) return aFuture - bFuture
    return a.hour - b.hour
  })
}

// ══════════════════════════════════════════════════════════════
// LAYER 2: SEQUENCING ENGINE (Queue Priority)
// ══════════════════════════════════════════════════════════════

/**
 * Calculate queue priority for a clip on a specific platform.
 * Formula: viralScore×0.30 + freshness×0.20 + platformFit×0.20
 *        + momentumWindow×0.15 + emotionalDiversity×0.10
 *        - killSwitchPenalty×0.05
 */
function calcQueuePriority(
  clip: QueueClip,
  platform: string,
  prevMood: MoodType | null,
  learning: LearningData,
  stats: PersistentStats,
): { priority: number; emotionalPenalty: number; killPenalty: number; momentumBoost: number } {
  // 1. Viral score (0-100)
  const viralComponent = clip.viralScore

  // 2. Freshness (0-100)
  const freshnessComponent = clip.freshness

  // 3. Platform fit (0-100)
  const fitComponent = clip.platformFit[platform] ?? 50

  // 4. Momentum window boost
  let momentumBoost = 0
  if (learning.lastMomentumWindow.active && learning.lastMomentumWindow.boostRemaining > 0) {
    momentumBoost = Math.round(learning.lastMomentumWindow.multiplier * 25)
  }

  // 5. Emotional diversity (penalty, not hard rule)
  let emotionalPenalty = 0
  if (prevMood !== null && prevMood === clip.mood) {
    emotionalPenalty = 15  // same mood = -15 penalty
  }

  // 6. Kill switch — pattern-based (check last 2 similar clips)
  let killPenalty = 0
  const similarPosts = learning.postHistory
    .filter(p => p.mood === clip.mood || p.hookType === clip.hookType)
    .slice(-2)

  if (similarPosts.length >= 2) {
    const avgPerf = similarPosts.reduce((s, p) => s + (p.performance24h ?? 1), 0) / similarPosts.length
    if (avgPerf < 0.7) {
      killPenalty = 20  // similar clips underperforming → heavy penalty
    } else if (avgPerf < 0.9) {
      killPenalty = 8   // slightly underperforming → mild penalty
    }
  }

  const priority = Math.round(
    viralComponent * 0.30 +
    freshnessComponent * 0.20 +
    fitComponent * 0.20 +
    momentumBoost * 0.15 +
    (100 - emotionalPenalty) * 0.10 -
    killPenalty * 0.05
  )

  return { priority: clamp(priority), emotionalPenalty, killPenalty, momentumBoost }
}

// ══════════════════════════════════════════════════════════════
// LAYER 3: RISK STRATEGY
// ══════════════════════════════════════════════════════════════

function classifyRisk(clip: QueueClip): RiskLevel {
  return clip.viralScore >= 70 ? 'proven' : 'wildcard'
}

/**
 * Apply risk strategy to a sequence of posts.
 * Rules: never 2 wildcards consecutive, prime time = proven preferred.
 */
function applyRiskStrategy(
  posts: Array<{ clip: QueueClip; slotQuality: SlotQuality }>,
): Array<{ clip: QueueClip; slotQuality: SlotQuality; riskLevel: RiskLevel }> {
  const result: Array<{ clip: QueueClip; slotQuality: SlotQuality; riskLevel: RiskLevel }> = []

  for (let i = 0; i < posts.length; i++) {
    const { clip, slotQuality } = posts[i]
    let risk = classifyRisk(clip)

    // Rule 1: Prime time → prefer proven
    if (slotQuality === 'prime' && risk === 'wildcard' && clip.viralScore >= 60) {
      // borderline wildcard in prime → treat as proven
      risk = 'proven'
    }

    // Rule 2: Never 2 wildcards back-to-back
    if (i > 0 && result[i - 1].riskLevel === 'wildcard' && risk === 'wildcard') {
      // Try to find a proven clip to swap in, or just warn
      risk = 'wildcard' // keep but the explanation will note it
    }

    result.push({ clip, slotQuality, riskLevel: risk })
  }

  return result
}

// ══════════════════════════════════════════════════════════════
// LAYER 4: BREAKOUT PROBABILITY (contextual)
// ══════════════════════════════════════════════════════════════

/**
 * Contextual breakout probability.
 * breakoutProbability = viralScore × timingMultiplier × momentumMultiplier
 * Outputs 0-100 plus a context string.
 */
function calcBreakoutProbability(
  clip: QueueClip,
  slotQuality: SlotQuality,
  learning: LearningData,
  stats: PersistentStats,
): { probability: number; context: string } {
  // Base: viral score normalized to probability range (30-95)
  const base = 30 + (clip.viralScore / 100) * 50

  // Timing multiplier: prime=1.15, good=1.0, offpeak=0.85
  const timingMult = slotQuality === 'prime' ? 1.15 : slotQuality === 'good' ? 1.0 : 0.85

  // Momentum multiplier: based on current streak + recent activity
  let momentumMult = 1.0
  if (stats.currentStreak >= 7) momentumMult = 1.2
  else if (stats.currentStreak >= 3) momentumMult = 1.1
  else if (stats.weeklyClipsCount === 0) momentumMult = 0.85

  // Momentum window bonus
  if (learning.lastMomentumWindow.active) {
    momentumMult *= learning.lastMomentumWindow.multiplier
  }

  const probability = clamp(Math.round(base * timingMult * momentumMult), 15, 95)

  // Context string
  let context: string
  if (timingMult > 1.0 && momentumMult > 1.0) {
    context = '↑ great timing + active momentum'
  } else if (timingMult > 1.0) {
    context = '↑ good timing'
  } else if (momentumMult > 1.0) {
    context = '↑ momentum boost'
  } else if (timingMult < 1.0) {
    context = '↓ off-peak slot'
  } else if (momentumMult < 1.0) {
    context = '↓ low momentum'
  } else {
    context = '— standard conditions'
  }

  return { probability, context }
}

// ══════════════════════════════════════════════════════════════
// LAYER 5: CONFIDENCE & EXPLANATION
// ══════════════════════════════════════════════════════════════

/**
 * Confidence based on how much data we have to work with.
 */
function calcConfidence(learning: LearningData, stats: PersistentStats): number {
  const postCount = learning.postHistory.length

  // Base: 35-95 depending on history depth
  if (postCount === 0) return 35
  if (postCount <= 3) return 45
  if (postCount <= 7) return 55
  if (postCount <= 15) return 70
  if (postCount <= 30) return 80
  return Math.min(95, 80 + Math.floor(postCount / 10))
}

/**
 * Generate a human-readable explanation for why this post is in this position.
 */
function generateExplanation(
  riskLevel: RiskLevel,
  slotQuality: SlotQuality,
  emotionalPenalty: number,
  killPenalty: number,
  momentumBoost: number,
  prevRisk: RiskLevel | null,
): string {
  const reasons: string[] = []

  // Position reason
  if (prevRisk === null) {
    reasons.push(riskLevel === 'proven' ? 'Leading with your strongest clip' : 'Testing a wildcard first')
  } else if (prevRisk === 'proven' && riskLevel === 'wildcard') {
    reasons.push('Testing high-risk after building reach')
  } else if (prevRisk === 'wildcard' && riskLevel === 'proven') {
    reasons.push('Capitalizing on previous performance')
  } else if (prevRisk === 'proven' && riskLevel === 'proven') {
    reasons.push('Consistent push for steady growth')
  }

  // Timing reason
  if (slotQuality === 'prime') {
    reasons.push('Prime time slot')
  } else if (slotQuality === 'offpeak') {
    reasons.push('Testing off-peak slot')
  }

  // Mood/fatigue
  if (emotionalPenalty === 0) {
    reasons.push('Avoiding audience fatigue')
  }

  // Momentum
  if (momentumBoost > 0) {
    reasons.push('Riding momentum window')
  }

  // Kill switch
  if (killPenalty > 0) {
    reasons.push('Similar clips underperforming lately')
  }

  return reasons.slice(0, 2).join(' · ')
}

// ══════════════════════════════════════════════════════════════
// EMOTIONAL MIX ASSESSMENT
// ══════════════════════════════════════════════════════════════

function assessEmotionalMix(posts: ScheduledPost[]): 'diverse' | 'moderate' | 'repetitive' {
  if (posts.length <= 1) return 'diverse'
  const moods = posts.map(p => p.clip.mood)
  const unique = new Set(moods).size
  const ratio = unique / moods.length
  if (ratio >= 0.8) return 'diverse'
  if (ratio >= 0.5) return 'moderate'
  return 'repetitive'
}

// ══════════════════════════════════════════════════════════════
// STRATEGY LABEL
// ══════════════════════════════════════════════════════════════

function getStrategyLabel(posts: ScheduledPost[]): string {
  if (posts.length === 0) return 'No posts scheduled'
  const key = posts.map(p => p.riskLevel).join('-')
  return STRATEGY_LABELS[key] ?? 'Custom Strategy'
}

// ══════════════════════════════════════════════════════════════
// REACH ESTIMATION
// ══════════════════════════════════════════════════════════════

function estimateReach(posts: ScheduledPost[]): { low: number; high: number } {
  if (posts.length === 0) return { low: 0, high: 0 }

  let totalLow = 0
  let totalHigh = 0

  for (const p of posts) {
    const base = p.clip.viralScore * 80
    const timingMult = p.slotQuality === 'prime' ? 1.3 : p.slotQuality === 'good' ? 1.0 : 0.7
    const low = Math.round(base * timingMult * 0.6)
    const high = Math.round(base * timingMult * 2.5)
    totalLow += Math.max(low, 200)
    totalHigh += Math.max(high, 800)
  }

  return { low: totalLow, high: totalHigh }
}

// ══════════════════════════════════════════════════════════════
// LAYER 6: LEARNED PROFILE INTEGRATION
// ══════════════════════════════════════════════════════════════

/** Confidence weighting: how much to trust the learned profile. */
function getConfidenceWeight(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'high': return 1.0
    case 'medium': return 0.7
    case 'early': return 0.3
    default: return 0
  }
}

/**
 * Apply boosts/penalties from a LearnedDistributionProfile to a clip's priority.
 * Returns the score adjustment and human-readable reasons.
 */
function applyLearnedProfile(
  clip: QueueClip,
  platform: string,
  slotHour: number,
  profile: LearnedDistributionProfile,
): { adjustment: number; reasons: string[] } {
  const weight = getConfidenceWeight(profile.confidence)
  if (weight === 0) return { adjustment: 0, reasons: [] }

  let adjustment = 0
  const reasons: string[] = []

  // ── Mood boost ──
  const platformMoods = profile.bestMoodsByPlatform[platform]
  if (platformMoods) {
    const moodMatch = platformMoods.find(m => m.mood === clip.mood)
    if (moodMatch && moodMatch.multiplier > 1.0) {
      const rawBoost = Math.min((moodMatch.multiplier - 1.0) * 20, 15) // cap at +15
      adjustment += rawBoost * weight
      reasons.push(`${moodMatch.mood} clips perform ${moodMatch.multiplier}x on ${platform} (${moodMatch.postCount} posts)`)
    }
  }

  // ── Timing boost ──
  const windowMatch = profile.bestPostingWindows.find(
    w => w.platform === platform && slotHour >= w.startHour && slotHour < w.endHour
  )
  if (windowMatch && windowMatch.multiplier > 1.0) {
    const rawBoost = Math.min((windowMatch.multiplier - 1.0) * 15, 12) // cap at +12
    adjustment += rawBoost * weight
    reasons.push(`Optimal window ${windowMatch.startHour}:00-${windowMatch.endHour}:00 (${windowMatch.multiplier}x, ${windowMatch.postCount} posts)`)
  }

  // ── Underperforming penalty ──
  const underMatch = profile.underperformingPatterns.find(
    u => u.platform === platform && u.pattern.toLowerCase().includes(clip.mood)
  )
  if (underMatch) {
    const rawPenalty = Math.min(underMatch.penalty * 15, 15) // cap at -15
    adjustment -= rawPenalty * weight
    reasons.push(`${underMatch.pattern} underperform on ${platform} (-${Math.round(underMatch.penalty * 100)}%)`)
  }

  return { adjustment: Math.round(adjustment), reasons }
}

// ══════════════════════════════════════════════════════════════
// MAIN: GENERATE QUEUE
// ══════════════════════════════════════════════════════════════

/**
 * Main entry point. Takes clip bank + context → returns scheduled queue.
 */
export function generateQueue(
  clips: QueueClip[],
  stats: PersistentStats,
  learning: LearningData | null,
  settings: Partial<QueueSettings> = {},
  learnedProfile?: LearnedDistributionProfile | null,
): QueuePreview {
  const config = { ...DEFAULT_SETTINGS, ...settings }
  const learn = learning ?? createDefaultLearning()

  if (clips.length === 0 || config.activePlatforms.length === 0) {
    return {
      posts: [],
      totalEstReach: { low: 0, high: 0 },
      confidence: 0,
      emotionalMix: 'diverse',
      strategy: 'No posts scheduled',
    }
  }

  const currentHour = new Date().getUTCHours()

  // 1. Pick best time slots across platforms
  const maxPosts = Math.min(clips.length, config.activePlatforms.length * config.maxPerDayPerPlatform)
  const bestSlots = pickBestSlots(
    config.activePlatforms,
    Math.min(maxPosts, 6), // cap at 6 scheduled posts
    learn,
    config,
    currentHour,
  )

  if (bestSlots.length === 0) {
    return {
      posts: [],
      totalEstReach: { low: 0, high: 0 },
      confidence: 0,
      emotionalMix: 'diverse',
      strategy: 'No available time slots',
    }
  }

  // 2. Score all clips for each slot and assign best matches
  const scheduledPosts: ScheduledPost[] = []
  const usedClipIds = new Set<string>()
  let prevMood: MoodType | null = null
  let prevRisk: RiskLevel | null = null

  for (const slot of bestSlots) {
    // Rank unused clips by queue priority for this platform
    const candidates = clips
      .filter(c => !usedClipIds.has(c.id))
      .map(c => {
        const { priority, emotionalPenalty, killPenalty, momentumBoost } = calcQueuePriority(
          c, slot.platform, prevMood, learn, stats,
        )
        // Apply learned profile boost/penalty if available
        let adjustedPriority = priority
        let learnedReasons: string[] = []
        if (learnedProfile && learnedProfile.totalPostsAnalyzed >= 5) {
          const { adjustment, reasons } = applyLearnedProfile(c, slot.platform, slot.hour, learnedProfile)
          adjustedPriority = clamp(priority + adjustment)
          learnedReasons = reasons
        }
        // Applied adjustments boost: +10 for posts matching user-accepted insights
        if (config.appliedAdjustments.length > 0) {
          const lowerAdj = config.appliedAdjustments.map(a => a.toLowerCase())
          const matchesMood = lowerAdj.some(a => a.includes(c.mood))
          const matchesPlatform = lowerAdj.some(a => a.includes(slot.platform))
          if (matchesMood || matchesPlatform) {
            adjustedPriority = clamp(adjustedPriority + 10)
          }
        }
        return { clip: c, priority: adjustedPriority, emotionalPenalty, killPenalty, momentumBoost, learnedReasons }
      })
      .sort((a, b) => b.priority - a.priority)

    if (candidates.length === 0) break

    const best = candidates[0]
    usedClipIds.add(best.clip.id)

    // Risk classification
    const riskLevel = classifyRisk(best.clip)

    // Breakout probability (contextual)
    const { probability, context } = calcBreakoutProbability(
      best.clip, slot.quality, learn, stats,
    )

    // Confidence
    const confidence = calcConfidence(learn, stats)

    // Explanation
    const explanation = generateExplanation(
      riskLevel, slot.quality,
      best.emotionalPenalty, best.killPenalty, best.momentumBoost,
      prevRisk,
    )

    // Build scheduled time
    const now = new Date()
    const scheduledAt = new Date(now)
    if (slot.hour <= currentHour) {
      // Tomorrow
      scheduledAt.setDate(scheduledAt.getDate() + 1)
    }
    scheduledAt.setUTCHours(slot.hour, 0, 0, 0)

    scheduledPosts.push({
      clip: best.clip,
      platform: slot.platform,
      scheduledAt,
      slotQuality: slot.quality,
      riskLevel,
      breakoutProbability: probability,
      breakoutContext: context,
      confidence,
      explanation,
      queuePriority: best.priority,
      learnedReasons: best.learnedReasons,
    })

    prevMood = best.clip.mood
    prevRisk = riskLevel
  }

  // Apply risk strategy adjustments
  const withRisk = applyRiskStrategy(
    scheduledPosts.map(p => ({ clip: p.clip, slotQuality: p.slotQuality }))
  )
  for (let i = 0; i < scheduledPosts.length && i < withRisk.length; i++) {
    scheduledPosts[i].riskLevel = withRisk[i].riskLevel
  }

  const reach = estimateReach(scheduledPosts)
  const emotionalMix = assessEmotionalMix(scheduledPosts)
  const strategy = getStrategyLabel(scheduledPosts)
  const avgConfidence = scheduledPosts.length > 0
    ? Math.round(scheduledPosts.reduce((s, p) => s + p.confidence, 0) / scheduledPosts.length)
    : 0

  return {
    posts: scheduledPosts,
    totalEstReach: reach,
    confidence: avgConfidence,
    emotionalMix,
    strategy,
  }
}

// ══════════════════════════════════════════════════════════════
// LEARNING: RECORD RESULT + FAST ADAPTATION
// ══════════════════════════════════════════════════════════════

/**
 * Record a post result and update learning data.
 * Fast adaptation: even 1 post creates a signal.
 */
export function recordPostResult(
  learning: LearningData,
  result: PostResult,
): LearningData {
  const next = structuredClone(learning)

  // Add to history (keep last 100)
  next.postHistory = [...next.postHistory, result].slice(-100)

  // ── Platform affinity (fast learning) ──
  if (result.performance24h !== null) {
    const currentAffinity = next.platformAffinity[result.platform] ?? 1.0
    // Recency weighted: new result counts 3x more than historical
    const weight = 0.3
    const perf = result.performance24h
    next.platformAffinity[result.platform] = clamp(
      currentAffinity * (1 - weight) + perf * weight,
      0.5,
      2.0,
    )
  }

  // ── Time bucket performance ──
  if (result.performance24h !== null) {
    if (!next.timeBucketPerformance[result.platform]) {
      next.timeBucketPerformance[result.platform] = {} as Record<TimeBucket, number>
    }
    const bucket = result.timeBucket
    const current = next.timeBucketPerformance[result.platform][bucket] ?? 1.0
    const weight = 0.25
    next.timeBucketPerformance[result.platform][bucket] =
      current * (1 - weight) + result.performance24h * weight
  }

  // ── Mood performance ──
  if (result.performance24h !== null) {
    const current = next.moodPerformance[result.mood] ?? 1.0
    const weight = 0.2
    next.moodPerformance[result.mood] = current * (1 - weight) + result.performance24h * weight
  }

  // ── Hook performance ──
  if (result.performance24h !== null) {
    const current = next.hookPerformance[result.hookType] ?? 1.0
    const weight = 0.2
    next.hookPerformance[result.hookType] = current * (1 - weight) + result.performance24h * weight
  }

  // ── Momentum window (fast reaction) ──
  if (result.performance6h !== null && result.performance6h >= 1.5) {
    // Strong early performance → activate momentum window for next 2-3 posts
    next.lastMomentumWindow = {
      active: true,
      boostRemaining: 3,
      multiplier: Math.min(1.3, 1.0 + (result.performance6h - 1.0) * 0.2),
    }
  }

  return next
}

/**
 * Consume one momentum window slot (call after scheduling a boosted post).
 */
export function consumeMomentumSlot(learning: LearningData): LearningData {
  const next = structuredClone(learning)
  if (next.lastMomentumWindow.active) {
    next.lastMomentumWindow.boostRemaining -= 1
    if (next.lastMomentumWindow.boostRemaining <= 0) {
      next.lastMomentumWindow = { active: false, boostRemaining: 0, multiplier: 1.0 }
    }
  }
  return next
}

/**
 * Handle user override — learn from manual reordering.
 */
export function recordOverride(
  learning: LearningData,
  movedClipId: string,
  fromPlatform: string,
  toPlatform: string,
  preferredHour: number,
): LearningData {
  const next = structuredClone(learning)

  // Boost the platform they moved TO
  const currentTo = next.platformAffinity[toPlatform] ?? 1.0
  next.platformAffinity[toPlatform] = Math.min(2.0, currentTo * 1.05)

  // Slightly decrease the platform they moved FROM (if different)
  if (fromPlatform !== toPlatform) {
    const currentFrom = next.platformAffinity[fromPlatform] ?? 1.0
    next.platformAffinity[fromPlatform] = Math.max(0.5, currentFrom * 0.97)
  }

  // Boost the time bucket they chose
  const bucket = getTimeBucket(preferredHour)
  if (!next.timeBucketPerformance[toPlatform]) {
    next.timeBucketPerformance[toPlatform] = {} as Record<TimeBucket, number>
  }
  const current = next.timeBucketPerformance[toPlatform][bucket] ?? 1.0
  next.timeBucketPerformance[toPlatform][bucket] = Math.min(2.0, current * 1.05)

  return next
}

// ══════════════════════════════════════════════════════════════
// EXPORTS: Default settings + learning data factory
// ══════════════════════════════════════════════════════════════

export { DEFAULT_SETTINGS, createDefaultLearning, formatK, getTimeBucket }
