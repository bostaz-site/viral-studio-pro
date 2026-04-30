import type { PersistentStats } from '@/lib/distribution/session-persistence'

export function formatK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

export function predictNextBreakout(stats: PersistentStats): {
  low: string
  high: string
  reasoning: string
} {
  const avgScore = stats.clipScores.length > 0
    ? stats.clipScores.reduce((a, b) => a + b, 0) / stats.clipScores.length
    : 50
  const momentum = stats.currentStreak >= 3 ? 1.5 : stats.currentStreak >= 1 ? 1.2 : 1.0
  const frequency = Math.min(stats.weeklyClipsCount / 3, 1.5)
  const baseReach = avgScore * 120 * momentum * frequency
  const highReach = baseReach * 2.8

  let reasoning = 'Based on your average clip score'
  if (stats.currentStreak >= 3) reasoning += ' + active streak bonus'
  if (stats.weeklyClipsCount >= 3) reasoning += ' + consistent posting'

  return { low: formatK(Math.max(baseReach, 500)), high: formatK(Math.max(highReach, 1400)), reasoning }
}

export function calcMissedViews(stats: PersistentStats): {
  missed: string
  clipsNeeded: number
} | null {
  if (stats.totalClipsPublished < 2) return null
  const avgViewsPerClip = stats.totalViewsProjected / Math.max(1, stats.totalClipsPublished)
  const optimalPerWeek = 5
  const gap = Math.max(0, optimalPerWeek - stats.weeklyClipsCount)
  if (gap === 0) return null
  const missed = gap * avgViewsPerClip
  return { missed: formatK(missed), clipsNeeded: gap }
}

export function getScoreDelta(stats: PersistentStats): {
  delta: number
  label: string
} | null {
  if (stats.lastWeekAvgScore === null) return null
  const delta = Math.round(stats.weeklyAvgScore - stats.lastWeekAvgScore)
  if (delta > 0) return { delta, label: `+${delta} pts vs last week` }
  if (delta < 0) return { delta, label: `${delta} pts vs last week` }
  return { delta: 0, label: 'Same as last week' }
}

export function getDailyQuest(
  dayOfWeek: number,
  stats: PersistentStats,
): { goal: string; reward: string; target: number; current: number; emoji: string } {
  const quests = [
    { goal: 'Post 1 clip today', reward: '+3 rank momentum', target: 1, emoji: '\uD83C\uDFAF' },
    { goal: 'Post 2 clips today', reward: '+5 rank boost', target: 2, emoji: '\uD83D\uDD25' },
    { goal: 'Try a new platform', reward: 'Platform Explorer badge', target: 1, emoji: '\uD83C\uDF0D' },
    { goal: 'Post a clip with score 70+', reward: 'Quality Creator badge', target: 1, emoji: '\u26A1' },
    { goal: 'Post 2 clips today', reward: '+5 rank boost', target: 2, emoji: '\uD83C\uDFAF' },
    { goal: 'Post 3 clips this weekend', reward: 'Weekend Warrior badge', target: 3, emoji: '\uD83D\uDCAA' },
    { goal: 'Keep your streak alive', reward: 'Streak Guardian badge', target: 1, emoji: '\uD83D\uDD25' },
  ]
  const quest = quests[dayOfWeek % quests.length]
  const today = new Date().toISOString().slice(0, 10)
  const postedToday = stats.lastPublishDate === today ? 1 : 0
  return { ...quest, current: Math.min(postedToday, quest.target) }
}
