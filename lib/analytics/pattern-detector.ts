/**
 * Pattern Detection Engine
 * Aggregates published_posts by dimension (mood, timing, caption style)
 * and generates a LearnedDistributionProfile for a user.
 *
 * All queries use admin client (service role) — called from API routes only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  getConfidenceLevel,
  type LearnedDistributionProfile,
  type LearnedInsight,
  type LearnedAdjustment,
  type ConfidenceLevel,
} from '@/types/learning'

const MIN_PATTERN_COUNT = 5
const UNDERPERFORM_THRESHOLD = 0.7

const HOUR_WINDOWS: Array<{ start: number; end: number; label: string }> = [
  { start: 0, end: 3, label: '12 AM – 3 AM' },
  { start: 3, end: 6, label: '3 AM – 6 AM' },
  { start: 6, end: 9, label: '6 AM – 9 AM' },
  { start: 9, end: 12, label: '9 AM – 12 PM' },
  { start: 12, end: 15, label: '12 PM – 3 PM' },
  { start: 15, end: 18, label: '3 PM – 6 PM' },
  { start: 18, end: 21, label: '6 PM – 9 PM' },
  { start: 21, end: 24, label: '9 PM – 12 AM' },
]

function getHourWindow(hour: number): { start: number; end: number; label: string } {
  return HOUR_WINDOWS.find(w => hour >= w.start && hour < w.end) ?? HOUR_WINDOWS[0]
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

interface PostRow {
  platform: string
  account_id: string | null
  clip_mood: string | null
  caption_style: string | null
  hook_style: string | null
  hook_enabled: boolean | null
  smart_zoom_mode: string | null
  posted_hour_local: number | null
  views: number | null
}

export async function computeProfileForUser(userId: string): Promise<LearnedDistributionProfile> {
  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('published_posts')
    .select('platform, account_id, clip_mood, caption_style, hook_style, hook_enabled, smart_zoom_mode, posted_hour_local, views')
    .eq('user_id', userId)
    .not('views', 'is', null)

  if (error || !rows || rows.length === 0) {
    return emptyProfile()
  }

  const posts = rows as PostRow[]
  const totalPostsAnalyzed = posts.length
  const confidence = getConfidenceLevel(totalPostsAnalyzed)

  // Global average views
  const totalViews = posts.reduce((sum, p) => sum + (p.views ?? 0), 0)
  const userAvgViews = totalViews / totalPostsAnalyzed

  if (userAvgViews === 0) return emptyProfile()

  // ── Best moods by platform ──
  const bestMoodsByPlatform = computeBestMoods(posts, userAvgViews)

  // ── Best posting windows ──
  const bestPostingWindows = computeBestWindows(posts, userAvgViews)

  // ── Best caption styles ──
  const bestCaptionStyles = computeBestCaptionStyles(posts, userAvgViews)

  // ── Underperforming patterns ──
  const underperformingPatterns = computeUnderperformers(posts, userAvgViews)

  // ── Generate adjustments from insights ──
  const adjustments = generateAdjustments(
    bestMoodsByPlatform, bestPostingWindows, bestCaptionStyles, underperformingPatterns, confidence,
  )

  return {
    bestMoodsByPlatform,
    bestPostingWindows,
    bestCaptionStyles,
    underperformingPatterns,
    adjustments,
    confidence,
    totalPostsAnalyzed,
    lastUpdated: new Date().toISOString(),
  }
}

function emptyProfile(): LearnedDistributionProfile {
  return {
    bestMoodsByPlatform: {},
    bestPostingWindows: [],
    bestCaptionStyles: [],
    underperformingPatterns: [],
    adjustments: [],
    confidence: 'none',
    totalPostsAnalyzed: 0,
    lastUpdated: new Date().toISOString(),
  }
}

// ── Aggregation helpers ──

function computeBestMoods(
  posts: PostRow[], userAvg: number,
): Record<string, { mood: string; multiplier: number; postCount: number }[]> {
  const groups = new Map<string, Map<string, number[]>>()

  for (const p of posts) {
    if (!p.clip_mood || p.views == null) continue
    if (!groups.has(p.platform)) groups.set(p.platform, new Map())
    const platMap = groups.get(p.platform)!
    if (!platMap.has(p.clip_mood)) platMap.set(p.clip_mood, [])
    platMap.get(p.clip_mood)!.push(p.views)
  }

  const result: Record<string, { mood: string; multiplier: number; postCount: number }[]> = {}

  for (const [platform, moodMap] of groups) {
    const entries: { mood: string; multiplier: number; postCount: number }[] = []
    for (const [mood, views] of moodMap) {
      if (views.length < MIN_PATTERN_COUNT) continue
      const avg = views.reduce((a, b) => a + b, 0) / views.length
      const multiplier = Math.round((avg / userAvg) * 10) / 10
      entries.push({ mood, multiplier, postCount: views.length })
    }
    entries.sort((a, b) => b.multiplier - a.multiplier)
    if (entries.length > 0) result[platform] = entries
  }

  return result
}

function computeBestWindows(
  posts: PostRow[], userAvg: number,
): LearnedDistributionProfile['bestPostingWindows'] {
  const groups = new Map<string, number[]>()

  for (const p of posts) {
    if (p.posted_hour_local == null || p.views == null) continue
    const w = getHourWindow(p.posted_hour_local)
    const key = `${p.platform}|${p.account_id ?? ''}|${w.start}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p.views)
  }

  const result: LearnedDistributionProfile['bestPostingWindows'] = []

  for (const [key, views] of groups) {
    if (views.length < MIN_PATTERN_COUNT) continue
    const [platform, accountId, startStr] = key.split('|')
    const start = parseInt(startStr, 10)
    const w = HOUR_WINDOWS.find(h => h.start === start) ?? HOUR_WINDOWS[0]
    const avg = views.reduce((a, b) => a + b, 0) / views.length
    const multiplier = Math.round((avg / userAvg) * 10) / 10
    result.push({
      platform,
      accountId,
      startHour: w.start,
      endHour: w.end,
      multiplier,
      postCount: views.length,
    })
  }

  result.sort((a, b) => b.multiplier - a.multiplier)
  return result
}

function computeBestCaptionStyles(
  posts: PostRow[], userAvg: number,
): LearnedDistributionProfile['bestCaptionStyles'] {
  const groups = new Map<string, number[]>()

  for (const p of posts) {
    if (!p.caption_style || p.views == null) continue
    const key = `${p.platform}|${p.caption_style}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p.views)
  }

  const result: LearnedDistributionProfile['bestCaptionStyles'] = []

  for (const [key, views] of groups) {
    if (views.length < MIN_PATTERN_COUNT) continue
    const [platform, style] = key.split('|')
    const avg = views.reduce((a, b) => a + b, 0) / views.length
    const multiplier = Math.round((avg / userAvg) * 10) / 10
    result.push({ platform, style, multiplier, postCount: views.length })
  }

  result.sort((a, b) => b.multiplier - a.multiplier)
  return result
}

function computeUnderperformers(
  posts: PostRow[], userAvg: number,
): LearnedDistributionProfile['underperformingPatterns'] {
  const result: LearnedDistributionProfile['underperformingPatterns'] = []

  // Check moods
  const moodGroups = new Map<string, number[]>()
  for (const p of posts) {
    if (!p.clip_mood || p.views == null) continue
    const key = `${p.platform}|mood:${p.clip_mood}`
    if (!moodGroups.has(key)) moodGroups.set(key, [])
    moodGroups.get(key)!.push(p.views)
  }
  for (const [key, views] of moodGroups) {
    if (views.length < MIN_PATTERN_COUNT) continue
    const avg = views.reduce((a, b) => a + b, 0) / views.length
    const multiplier = avg / userAvg
    if (multiplier < UNDERPERFORM_THRESHOLD) {
      const [platform, pattern] = key.split('|')
      const penalty = Math.round((1 - multiplier) * 10) / 10
      result.push({ platform, pattern: pattern.replace('mood:', '') + ' clips', penalty, postCount: views.length })
    }
  }

  // Check time windows
  const timeGroups = new Map<string, number[]>()
  for (const p of posts) {
    if (p.posted_hour_local == null || p.views == null) continue
    const w = getHourWindow(p.posted_hour_local)
    const key = `${p.platform}|${w.label}`
    if (!timeGroups.has(key)) timeGroups.set(key, [])
    timeGroups.get(key)!.push(p.views)
  }
  for (const [key, views] of timeGroups) {
    if (views.length < MIN_PATTERN_COUNT) continue
    const avg = views.reduce((a, b) => a + b, 0) / views.length
    const multiplier = avg / userAvg
    if (multiplier < UNDERPERFORM_THRESHOLD) {
      const [platform, pattern] = key.split('|')
      const penalty = Math.round((1 - multiplier) * 10) / 10
      result.push({ platform, pattern: `Posts at ${pattern}`, penalty, postCount: views.length })
    }
  }

  result.sort((a, b) => b.penalty - a.penalty)
  return result
}

// ── Adjustment generation ──

function generateAdjustments(
  moods: LearnedDistributionProfile['bestMoodsByPlatform'],
  windows: LearnedDistributionProfile['bestPostingWindows'],
  captions: LearnedDistributionProfile['bestCaptionStyles'],
  underperformers: LearnedDistributionProfile['underperformingPatterns'],
  confidence: ConfidenceLevel,
): LearnedAdjustment[] {
  const adjustments: LearnedAdjustment[] = []

  // Best mood per platform
  for (const [platform, entries] of Object.entries(moods)) {
    const best = entries[0]
    if (best && best.multiplier >= 1.3) {
      const label = PLATFORM_LABELS[platform] ?? platform
      adjustments.push({
        change: `Prioritize ${best.mood} clips on ${label}`,
        reason: `${best.mood} clips performed ${best.multiplier}x above your average (based on ${best.postCount} posts)`,
        confidence,
      })
    }
  }

  // Best posting window
  if (windows.length > 0) {
    const best = windows[0]
    if (best.multiplier >= 1.2) {
      const label = PLATFORM_LABELS[best.platform] ?? best.platform
      const w = HOUR_WINDOWS.find(h => h.start === best.startHour)
      adjustments.push({
        change: `Shift ${label} posting to ${w?.label ?? `${best.startHour}:00`}`,
        reason: `Posts in this window reach ${best.multiplier}x more viewers (based on ${best.postCount} posts)`,
        confidence,
      })
    }
  }

  // Best caption style
  if (captions.length > 0) {
    const best = captions[0]
    if (best.multiplier >= 1.2) {
      const label = PLATFORM_LABELS[best.platform] ?? best.platform
      adjustments.push({
        change: `Use ${best.style} captions on ${label}`,
        reason: `${best.style} captions get ${best.multiplier}x more views (based on ${best.postCount} posts)`,
        confidence,
      })
    }
  }

  // Avoid underperformers
  for (const under of underperformers.slice(0, 2)) {
    const label = PLATFORM_LABELS[under.platform] ?? under.platform
    adjustments.push({
      change: `Avoid ${under.pattern} on ${label}`,
      reason: `This pattern performs ${Math.round(under.penalty * 100)}% below your average (based on ${under.postCount} posts)`,
      confidence,
    })
  }

  return adjustments
}
