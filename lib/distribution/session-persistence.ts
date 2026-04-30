/* ─── Session Persistence ───
 * Cross-session memory using localStorage.
 * Survives page refresh, browser close, and multi-day gaps.
 * All functions are pure or side-effect-isolated.
 * Graceful fallback: SSR / private browsing → defaults, no errors.
 */

const STORAGE_KEY = 'viral-animal-distribution-stats'

// ── Types ──

export interface PersistentStats {
  totalClipsPublished: number
  totalViewsProjected: number
  clipsByTone: Record<string, number>
  clipsByPlatform: Record<string, number>
  clipScores: number[]               // last 50 scores for avg calculation
  weeklyClipsCount: number
  weeklyAvgScore: number
  lastWeekAvgScore: number | null    // for "vs last week" comparison
  weekNumber: number                 // ISO week when weekly stats were last updated
  bestClipScore: number
  bestClipTitle: string | null
  currentStreak: number              // consecutive days with at least 1 publish
  longestStreak: number
  lastPublishDate: string | null     // ISO date "2026-04-29"
  lastSessionDate: string | null
  sessionsCount: number
  firstUseDate: string
}

// ── Helpers ──

function hasLocalStorage(): boolean {
  try {
    const key = '__va_test__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00Z').getTime()
  const msB = new Date(b + 'T00:00:00Z').getTime()
  return Math.round(Math.abs(msB - msA) / 86400000)
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function createDefaults(): PersistentStats {
  const now = new Date()
  return {
    totalClipsPublished: 0,
    totalViewsProjected: 0,
    clipsByTone: {},
    clipsByPlatform: {},
    clipScores: [],
    weeklyClipsCount: 0,
    weeklyAvgScore: 0,
    lastWeekAvgScore: null,
    weekNumber: getWeekNumber(now),
    bestClipScore: 0,
    bestClipTitle: null,
    currentStreak: 0,
    longestStreak: 0,
    lastPublishDate: null,
    lastSessionDate: null,
    sessionsCount: 0,
    firstUseDate: toISODate(now),
  }
}

// ── Core functions ──

export function loadPersistentStats(): PersistentStats {
  if (!hasLocalStorage()) return createDefaults()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const defaults = createDefaults()
      defaults.sessionsCount = 1
      defaults.lastSessionDate = toISODate(new Date())
      savePersistentStats(defaults)
      return defaults
    }

    const parsed = JSON.parse(raw) as Partial<PersistentStats>
    const defaults = createDefaults()
    const stats: PersistentStats = { ...defaults, ...parsed }

    // Ensure clipScores is an array (guard against corruption)
    if (!Array.isArray(stats.clipScores)) stats.clipScores = []

    // Weekly rollover check
    const currentWeek = getWeekNumber(new Date())
    if (stats.weekNumber !== currentWeek) {
      stats.lastWeekAvgScore = stats.weeklyClipsCount > 0 ? stats.weeklyAvgScore : stats.lastWeekAvgScore
      stats.weeklyClipsCount = 0
      stats.weeklyAvgScore = 0
      stats.weekNumber = currentWeek
    }

    // Bump session count if different day
    const today = toISODate(new Date())
    if (stats.lastSessionDate !== today) {
      stats.sessionsCount += 1
      stats.lastSessionDate = today
    }

    savePersistentStats(stats)
    return stats
  } catch {
    return createDefaults()
  }
}

export function savePersistentStats(stats: PersistentStats): void {
  if (!hasLocalStorage()) return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // Storage full or unavailable — silently skip
  }
}

export function recordPersistentPublish(
  stats: PersistentStats,
  data: {
    clipScore: number
    clipTitle: string
    tone: string
    platforms: string[]
    projectedViews: number
  },
): PersistentStats {
  const next = { ...stats }
  const today = toISODate(new Date())

  // ── Totals ──
  next.totalClipsPublished = stats.totalClipsPublished + 1
  next.totalViewsProjected = stats.totalViewsProjected + data.projectedViews

  // ── By tone ──
  next.clipsByTone = { ...stats.clipsByTone }
  next.clipsByTone[data.tone] = (next.clipsByTone[data.tone] ?? 0) + 1

  // ── By platform ──
  next.clipsByPlatform = { ...stats.clipsByPlatform }
  for (const p of data.platforms) {
    next.clipsByPlatform[p] = (next.clipsByPlatform[p] ?? 0) + 1
  }

  // ── Score tracking (keep last 50) ──
  next.clipScores = [...stats.clipScores, data.clipScore].slice(-50)

  // ── Weekly stats ──
  next.weeklyClipsCount = stats.weeklyClipsCount + 1
  const weeklyTotal = stats.weeklyAvgScore * stats.weeklyClipsCount + data.clipScore
  next.weeklyAvgScore = Math.round(weeklyTotal / next.weeklyClipsCount)

  // ── Best clip ──
  if (data.clipScore > stats.bestClipScore) {
    next.bestClipScore = data.clipScore
    next.bestClipTitle = data.clipTitle
  }

  // ── Streak logic ──
  if (stats.lastPublishDate === null) {
    // First ever publish
    next.currentStreak = 1
  } else if (stats.lastPublishDate === today) {
    // Already published today — streak unchanged
    next.currentStreak = stats.currentStreak
  } else if (daysBetween(stats.lastPublishDate, today) === 1) {
    // Yesterday — extend streak
    next.currentStreak = stats.currentStreak + 1
  } else {
    // Gap — reset streak
    next.currentStreak = 1
  }
  next.longestStreak = Math.max(next.currentStreak, stats.longestStreak)
  next.lastPublishDate = today

  savePersistentStats(next)
  return next
}

// ── Welcome back data ──

export function getWelcomeBackData(stats: PersistentStats): {
  isReturningUser: boolean
  daysSinceLastSession: number
  message: string
  continuationHint: string
} | null {
  if (stats.sessionsCount <= 1 || !stats.lastSessionDate) return null

  const today = toISODate(new Date())
  if (stats.lastSessionDate === today && stats.sessionsCount <= 1) return null

  const daysSince = stats.lastSessionDate === today ? 0 : daysBetween(stats.lastSessionDate, today)
  if (daysSince === 0 && stats.totalClipsPublished === 0) return null

  // ── Build message ──
  let message: string
  if (daysSince === 0) {
    message = `Welcome back! You've published ${stats.totalClipsPublished} clip${stats.totalClipsPublished !== 1 ? 's' : ''} so far`
  } else if (daysSince === 1) {
    message = stats.currentStreak > 1
      ? `Welcome back! You're on a ${stats.currentStreak}-day streak`
      : `Welcome back! Pick up where you left off yesterday`
  } else if (daysSince <= 7) {
    message = stats.longestStreak > 2
      ? `Welcome back! You had a ${stats.longestStreak}-day streak going \u2014 let's restart it`
      : `Welcome back! ${daysSince} days since your last session`
  } else {
    message = `Welcome back! It's been ${daysSince} days \u2014 your audience is waiting`
  }

  // ── Continuation hint based on top tone ──
  const toneEntries = Object.entries(stats.clipsByTone)
  let continuationHint: string
  if (toneEntries.length > 0) {
    toneEntries.sort((a, b) => b[1] - a[1])
    const topTone = toneEntries[0][0]
    const formatted = topTone.charAt(0).toUpperCase() + topTone.slice(1)
    continuationHint = `Your ${formatted.toLowerCase()} clips performed best \u2014 pick up where you left off`
  } else {
    continuationHint = 'Start with a high-scoring clip for maximum impact'
  }

  return {
    isReturningUser: true,
    daysSinceLastSession: daysSince,
    message,
    continuationHint,
  }
}

// ── "What worked" summary ──

export function getWhatWorkedSummary(stats: PersistentStats): {
  topTone: { name: string; performanceVsAvg: number } | null
  topPlatform: { name: string; multiplierVsOthers: number } | null
  bestTimeOfDay: string | null
  recommendation: string
} {
  const empty = {
    topTone: null,
    topPlatform: null,
    bestTimeOfDay: null,
    recommendation: 'Publish your first clip to start building insights',
  }

  if (stats.totalClipsPublished < 2) return empty

  // ── Top tone ──
  const toneEntries = Object.entries(stats.clipsByTone)
  let topTone: { name: string; performanceVsAvg: number } | null = null
  if (toneEntries.length >= 2) {
    toneEntries.sort((a, b) => b[1] - a[1])
    const totalToneClips = toneEntries.reduce((s, e) => s + e[1], 0)
    const avgPerTone = totalToneClips / toneEntries.length
    const best = toneEntries[0]
    if (avgPerTone > 0) {
      const performanceVsAvg = Math.round(((best[1] - avgPerTone) / avgPerTone) * 100)
      topTone = {
        name: best[0].charAt(0).toUpperCase() + best[0].slice(1),
        performanceVsAvg,
      }
    }
  }

  // ── Top platform ──
  const platEntries = Object.entries(stats.clipsByPlatform)
  let topPlatform: { name: string; multiplierVsOthers: number } | null = null
  if (platEntries.length >= 2) {
    platEntries.sort((a, b) => b[1] - a[1])
    const best = platEntries[0]
    const others = platEntries.slice(1)
    const avgOthers = others.reduce((s, e) => s + e[1], 0) / others.length
    if (avgOthers > 0) {
      const labels: Record<string, string> = {
        tiktok: 'TikTok',
        youtube: 'YouTube',
        instagram: 'Instagram',
      }
      topPlatform = {
        name: labels[best[0]] ?? best[0],
        multiplierVsOthers: Math.round((best[1] / avgOthers) * 10) / 10,
      }
    }
  }

  // ── Recommendation ──
  let recommendation: string
  if (topTone && topPlatform) {
    recommendation = `Double down on ${topTone.name.toLowerCase()} content on ${topPlatform.name}`
  } else if (topTone) {
    recommendation = `Your ${topTone.name.toLowerCase()} clips are working \u2014 lean into that style`
  } else if (topPlatform) {
    recommendation = `Focus on ${topPlatform.name} where you're seeing the most traction`
  } else {
    recommendation = 'Try different tones and platforms to find your best formula'
  }

  return {
    topTone,
    topPlatform,
    bestTimeOfDay: null, // no timestamp tracking yet
    recommendation,
  }
}
