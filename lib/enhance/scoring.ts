// ═════════════════════════════════════════════════════════════════════════════
// Scoring Engine for Viral Animal
// Extracted from app/(dashboard)/dashboard/enhance/[clipId]/page.tsx
// ═════════════════════════════════════════════════════════════════════════════

import type { TrendingClip } from '@/types/trending'
import { MOOD_PRESETS, type ClipMood } from '@/lib/ai/mood-presets'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Full EnhanceSettings interface — shared between enhance page and live preview.
 */
export interface EnhanceSettings {
  captionsEnabled: boolean
  captionStyle: string
  emphasisEffect: string
  emphasisColor: string
  customImportantWords: string[]
  captionPosition: number
  wordsPerLine: number
  splitScreenEnabled: boolean
  brollVideo: string
  splitRatio: number
  videoZoom: 'contain' | 'fill' | 'immersive'
  tagStyle: string
  tagSize: number
  aspectRatio: '9:16' | '1:1' | '16:9'
  smartZoomEnabled: boolean
  smartZoomMode: 'micro' | 'dynamic' | 'follow'
  audioEnhanceEnabled: boolean
  bassBoost: 'off' | 'mild' | 'heavy'
  speedRamp: 'off' | 'subtle' | 'dynamic'
  autoCutEnabled: boolean
  autoCutThreshold: number
  hookEnabled: boolean
  hookTextEnabled: boolean
  hookReorderEnabled: boolean
  hookText: string
  hookStyle: 'shock' | 'curiosity' | 'suspense'
  hookTextPosition: number
  hookLength: number
  hookReorder: { segments: { start: number; end: number; duration: number; label: string }[]; totalDuration: number; peakTime: number } | null
}

/**
 * Represents a scored option with its ID, computed score, and best-match flag.
 */
export interface ScoredOption {
  id: string
  score: number
  isBest: boolean
}

/**
 * Represents a caption style option with all its properties.
 */
export interface CaptionStyle {
  id: string
  label: string
  preview: string
  highlightClass: string
  baseScore: number
  animation: string
  animLabel: string
}

/**
 * Represents an emphasis effect option.
 */
export interface EmphasisEffect {
  id: string
  label: string
  description: string
  baseScore: number
}

/**
 * Represents a color option for emphasis.
 */
export interface EmphasisColor {
  id: string
  label: string
  tw: string
  hex: string
}

/**
 * Represents a b-roll option.
 */
export interface BrollOption {
  id: string
  label: string
  color: string
  baseScore: number
}

/**
 * Represents a tag style option.
 */
export interface TagStyle {
  id: string
  label: string
  description: string
  icon: string
  baseScore: number
  position: 'bottom-left' | 'none'
}

/**
 * Subset of TrendingClip used by the enhance scoring engine.
 */
export type TrendingClipData = Pick<TrendingClip,
  'id' | 'external_url' | 'platform' | 'author_name' | 'author_handle' |
  'title' | 'description' | 'niche' | 'view_count' | 'like_count' |
  'velocity_score' | 'thumbnail_url' | 'duration_seconds'
>

/**
 * Return type of computeScores function.
 */
export interface ComputedScores {
  captionScores: ScoredOption[]
  emphasisScores: ScoredOption[]
  brollScores: ScoredOption[]
  tagScores: ScoredOption[]
  best: {
    captionStyle: string
    emphasisEffect: string
    brollVideo: string
    tagStyle: string
  }
  totalBestScore: number
}

// ─── Scoring Constants ──────────────────────────────────────────────────────

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: 'word-pop',
    label: 'Word Pop',
    preview: 'text-white font-black uppercase',
    highlightClass: 'text-white bg-white/20',
    baseScore: 14,
    animation: 'word-pop',
    animLabel: 'Word Pop',
  },
  {
    id: 'highlight',
    label: 'Highlight',
    preview: 'text-white font-black uppercase',
    highlightClass: 'text-white bg-white/20',
    baseScore: 12,
    animation: 'highlight',
    animLabel: 'Highlight',
  },
  {
    id: 'bounce',
    label: 'Bounce',
    preview: 'text-white font-black uppercase',
    highlightClass: 'text-white bg-white/20',
    baseScore: 11,
    animation: 'bounce',
    animLabel: 'Bounce',
  },
  {
    id: 'glow',
    label: 'Glow',
    preview: 'text-white font-black uppercase',
    highlightClass: 'text-white bg-white/20',
    baseScore: 10,
    animation: 'glow',
    animLabel: 'Glow',
  },
  {
    id: 'none',
    label: 'None',
    preview: 'text-muted-foreground line-through',
    highlightClass: '',
    baseScore: 0,
    animation: 'highlight',
    animLabel: '',
  },
]

export const EMPHASIS_EFFECTS: EmphasisEffect[] = [
  { id: 'none', label: 'None', description: "No emphasis", baseScore: 0 },
  { id: 'scale', label: 'Scale Up', description: 'Keyword grows', baseScore: 14 },
  { id: 'bounce', label: 'Bounce', description: 'Keyword bounces', baseScore: 10 },
  { id: 'glow', label: 'Glow', description: 'Keyword glows', baseScore: 8 },
]

export const EMPHASIS_COLORS: EmphasisColor[] = [
  { id: 'red', label: 'Red', tw: 'bg-red-500', hex: '#EF4444' },
  { id: 'yellow', label: 'Yellow', tw: 'bg-yellow-400', hex: '#FACC15' },
  { id: 'cyan', label: 'Cyan', tw: 'bg-cyan-400', hex: '#22D3EE' },
  { id: 'green', label: 'Green', tw: 'bg-green-400', hex: '#4ADE80' },
  { id: 'orange', label: 'Orange', tw: 'bg-orange-500', hex: '#F97316' },
  { id: 'pink', label: 'Pink', tw: 'bg-pink-500', hex: '#EC4899' },
  { id: 'purple', label: 'Purple', tw: 'bg-purple-400', hex: '#C77DFF' },
  { id: 'white', label: 'White', tw: 'bg-white', hex: '#FFFFFF' },
]

export const BROLL_OPTIONS: BrollOption[] = [
  { id: 'subway-surfers', label: 'Subway Surfers', color: 'from-emerald-500 to-teal-500', baseScore: 14 },
  { id: 'minecraft-parkour', label: 'Minecraft Parkour', color: 'from-green-600 to-lime-500', baseScore: 12 },
  { id: 'sand-cutting', label: 'Sand Cutting', color: 'from-amber-500 to-orange-500', baseScore: 10 },
  { id: 'soap-cutting', label: 'Soap Cutting', color: 'from-pink-500 to-rose-500', baseScore: 9 },
  { id: 'slime-satisfying', label: 'Slime', color: 'from-purple-500 to-violet-500', baseScore: 8 },
  { id: 'none', label: 'None', color: 'from-slate-700 to-slate-800', baseScore: 0 },
]

export const TAG_STYLES: TagStyle[] = [
  {
    id: 'viral-glow',
    label: 'Viral Glow',
    description: 'Black capsule + neon purple border + glow',
    icon: '🔥',
    baseScore: 14,
    position: 'bottom-left',
  },
  {
    id: 'kick-glow',
    label: 'Kick Glow',
    description: 'Black capsule + neon green border + glow',
    icon: '💚',
    baseScore: 14,
    position: 'bottom-left',
  },
  {
    id: 'twitch-minimal',
    label: 'Twitch Minimal',
    description: 'Clean black tag with subtle purple border',
    icon: '🟣',
    baseScore: 10,
    position: 'bottom-left',
  },
  {
    id: 'kick-minimal',
    label: 'Kick Minimal',
    description: 'Clean black tag with subtle green border',
    icon: '🟢',
    baseScore: 10,
    position: 'bottom-left',
  },
  {
    id: 'none',
    label: 'None',
    description: 'No visible tag',
    icon: '🚫',
    baseScore: 0,
    position: 'none',
  },
]

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Format a number for display (K for thousands, M for millions).
 * Returns '--' for null values.
 */
export function formatCount(n: number | null): string {
  if (n === null) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Scoring Engine ─────────────────────────────────────────────────────────

/**
 * Compute viral potential scores for all enhancement options based on clip data.
 * Returns normalized scores out of 100 with weighted distribution:
 * - Caption styles: 35%
 * - Emphasis effects: 15%
 * - B-roll: 30%
 * - Tags: 20%
 */
export function computeScores(clip: TrendingClipData): ComputedScores {
  const velocity = clip.velocity_score ?? 50
  const views = clip.view_count ?? 0
  const niche = clip.niche?.toLowerCase() ?? 'irl'
  const isHighEnergy = velocity >= 70 || views >= 1_000_000
  const isMidEnergy = velocity >= 40 || views >= 100_000

  // Score caption animations based on clip characteristics
  const captionScores: ScoredOption[] = CAPTION_STYLES.map((s) => {
    let score = s.baseScore
    if (isHighEnergy && s.id === 'word-pop') score += 6
    if (!isHighEnergy && s.id === 'highlight') score += 4
    if (isMidEnergy && (s.id === 'bounce' || s.id === 'glow')) score += 3
    return { id: s.id, score, isBest: false }
  })
  const maxCaption = Math.max(...captionScores.map((s) => s.score))
  captionScores.forEach((s) => {
    s.isBest = s.score === maxCaption
  })

  // Score emphasis effects
  const emphasisScores: ScoredOption[] = EMPHASIS_EFFECTS.map((e) => {
    let score = e.baseScore
    if (isHighEnergy && (e.id === 'scale' || e.id === 'bounce')) score += 5
    if (!isHighEnergy && e.id === 'glow') score += 4
    if (niche === 'gaming' && e.id === 'scale') score += 3
    if (niche === 'irl' && e.id === 'glow') score += 3
    return { id: e.id, score, isBest: false }
  })
  const maxEmphasis = Math.max(...emphasisScores.map((s) => s.score))
  emphasisScores.forEach((s) => {
    s.isBest = s.score === maxEmphasis
  })

  // Score b-roll
  const brollScores: ScoredOption[] = BROLL_OPTIONS.map((b) => {
    let score = b.baseScore
    if (isHighEnergy && b.id === 'minecraft-parkour') score += 6
    if (niche === 'irl' && b.id === 'subway-surfers') score += 7
    if (!isHighEnergy && (b.id === 'sand-cutting' || b.id === 'soap-cutting')) score += 4
    if (isMidEnergy && b.id === 'subway-surfers') score += 3
    return { id: b.id, score, isBest: false }
  })
  const maxBroll = Math.max(...brollScores.map((s) => s.score))
  brollScores.forEach((s) => {
    s.isBest = s.score === maxBroll
  })

  // Score tag styles — platform-aware: Kick tags score 0 on Twitch clips and vice versa
  const clipPlatform = (clip.platform ?? '').toLowerCase()
  const tagScores: ScoredOption[] = TAG_STYLES.map((t) => {
    // Cross-platform tags get zero score
    if (clipPlatform === 'twitch' && (t.id === 'kick-glow' || t.id === 'kick-minimal')) {
      return { id: t.id, score: 0, isBest: false }
    }
    if (clipPlatform === 'kick' && (t.id === 'viral-glow' || t.id === 'twitch-minimal')) {
      return { id: t.id, score: 0, isBest: false }
    }
    let score = t.baseScore
    if (t.id === 'viral-glow' && clip.author_handle) score += 5
    if (t.id === 'twitch-minimal' || t.id === 'kick-minimal') score += 2
    return { id: t.id, score, isBest: false }
  })
  const maxTag = Math.max(...tagScores.map((s) => s.score))
  tagScores.forEach((s) => {
    s.isBest = s.score === maxTag
  })

  // Normalize scores to /100 — weights: captions 35, emphasis 15, b-roll 30, tags 20
  const WEIGHTS = { caption: 35, emphasis: 15, broll: 30, tag: 20 }

  const normCaption = captionScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxCaption) * WEIGHTS.caption),
  }))
  const normEmphasis = emphasisScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxEmphasis) * WEIGHTS.emphasis),
  }))
  const normBroll = brollScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxBroll) * WEIGHTS.broll),
  }))
  const normTag = tagScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxTag) * WEIGHTS.tag),
  }))

  // Best combo — safe fallbacks instead of non-null assertions
  const bestCaption = captionScores.find((s) => s.isBest)?.id ?? captionScores[0]?.id ?? 'word-pop'
  const bestEmphasis = emphasisScores.find((s) => s.isBest)?.id ?? emphasisScores[0]?.id ?? 'highlight'
  const bestBroll = brollScores.find((s) => s.isBest)?.id ?? brollScores[0]?.id ?? 'subway-surfers'
  const bestTag = tagScores.find((s) => s.isBest)?.id ?? tagScores[0]?.id ?? 'viral-glow'

  return {
    captionScores: normCaption,
    emphasisScores: normEmphasis,
    brollScores: normBroll,
    tagScores: normTag,
    best: { captionStyle: bestCaption, emphasisEffect: bestEmphasis, brollVideo: bestBroll, tagStyle: bestTag },
    totalBestScore: 100,
  }
}

/**
 * Baseline viral score for the Enhance page.
 * velocity_score already includes the display curve (40–95 range),
 * so we use it directly. Floor at 30 for uploaded clips with no data.
 */
export function computeBaselineScore(clip: TrendingClipData): number {
  const velocity = clip.velocity_score ?? 0
  return Math.max(30, velocity)
}

/**
 * Compute the current viral score based on user's enhancement settings.
 * Uses diminishing returns: each option adds a percentage of the remaining
 * headroom (99 - baseline). High-baseline clips get smaller absolute boosts
 * but start from a strong position. Low-baseline clips get bigger boosts.
 *
 * Example with captions (weight 0.14):
 *   baseline 50 → headroom 49 → +6.9 pts → score 56.9
 *   baseline 85 → headroom 14 → +2.0 pts → score 87.0
 *   baseline 93 → headroom  6 → +0.8 pts → score 93.8
 *
 * Hard cap at 99.0 — never reaches 100.
 */
export function computeCurrentScore(
  settings: EnhanceSettings,
  scores: ComputedScores,
  baseline = 0,
  detectedMood?: ClipMood | null
): number {
  const CAP = 99.0
  const headroom = Math.max(0, CAP - baseline)
  let totalWeight = 0

  // Base option weights (sum ~0.69 with everything on)
  if (settings.captionsEnabled && settings.captionStyle !== 'none') totalWeight += 0.14
  if (settings.emphasisEffect !== 'none') totalWeight += 0.08
  if (settings.splitScreenEnabled) totalWeight += 0.12
  if (settings.tagStyle !== 'none') totalWeight += 0.08
  if (settings.hookEnabled) totalWeight += 0.11
  if (settings.hookReorderEnabled) totalWeight += 0.05
  if (settings.smartZoomEnabled) totalWeight += 0.05
  if (settings.audioEnhanceEnabled) totalWeight += 0.03
  if (settings.bassBoost === 'mild') totalWeight += 0.03
  else if (settings.bassBoost === 'heavy') totalWeight += 0.05
  if (settings.speedRamp === 'subtle') totalWeight += 0.02
  else if (settings.speedRamp === 'dynamic') totalWeight += 0.03
  if (settings.autoCutEnabled) totalWeight += 0.03

  // Mood-match bonus weights (up to ~0.16 extra)
  if (detectedMood && MOOD_PRESETS[detectedMood]) {
    const preset = MOOD_PRESETS[detectedMood]
    if (settings.captionsEnabled && settings.captionStyle === preset.captionStyle) totalWeight += 0.06
    if (settings.emphasisEffect === preset.emphasisEffect) totalWeight += 0.04
    if (settings.emphasisColor === preset.emphasisColor) totalWeight += 0.03
    if (settings.videoZoom === preset.videoZoom) totalWeight += 0.02
    if (settings.smartZoomEnabled && settings.smartZoomMode === preset.smartZoomMode) totalWeight += 0.02
    if (settings.autoCutEnabled === preset.autoCutEnabled) totalWeight += 0.02
  } else {
    // Fallback generic best-option bonus when no mood detected
    if (settings.captionStyle === scores.best.captionStyle) totalWeight += 0.02
    if (settings.emphasisEffect === scores.best.emphasisEffect) totalWeight += 0.02
    if (settings.splitScreenEnabled && settings.brollVideo === scores.best.brollVideo) totalWeight += 0.02
    if (settings.tagStyle === scores.best.tagStyle) totalWeight += 0.02
  }

  const boost = headroom * totalWeight
  return Math.min(CAP, Math.round((baseline + boost) * 10) / 10)
}

// ─── Score Label ────────────────────────────────────────────────────────────

/**
 * Get a human-readable label and color for a viral score.
 */
export function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 95) return { text: 'Legendary potential', color: 'text-orange-400' }
  if (score >= 85) return { text: 'Viral ready', color: 'text-green-400' }
  if (score >= 70) return { text: 'High potential', color: 'text-blue-400' }
  if (score >= 55) return { text: 'Good base', color: 'text-yellow-400' }
  return { text: 'Rising', color: 'text-muted-foreground' }
}
