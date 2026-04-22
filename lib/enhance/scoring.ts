// ═════════════════════════════════════════════════════════════════════════════
// Scoring Engine for Viral Animal
// Extracted from app/(dashboard)/dashboard/enhance/[clipId]/page.tsx
// ═════════════════════════════════════════════════════════════════════════════

import type { TrendingClip } from '@/types/trending'

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
  autoCutEnabled: boolean
  autoCutThreshold: number
  hookEnabled: boolean
  hookTextEnabled: boolean
  hookReorderEnabled: boolean
  hookText: string
  hookStyle: 'choc' | 'curiosite' | 'suspense'
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
  'velocity_score' | 'thumbnail_url'
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
    id: 'hormozi',
    label: 'Hormozi',
    preview: 'text-white font-black uppercase',
    highlightClass: 'text-white bg-white/20',
    baseScore: 12,
    animation: 'word-pop',
    animLabel: 'Word Pop',
  },
  {
    id: 'hormozi-purple',
    label: 'Hormozi Purple',
    // Arbitrary hex matches the render exactly (#C77DFF — same as
    // viral-glow tag/hook). Using text-purple-400 would shift the tone.
    preview: 'text-[#C77DFF] font-black uppercase',
    highlightClass: 'text-[#C77DFF] bg-[#C77DFF]/20',
    baseScore: 13,
    animation: 'word-pop',
    animLabel: 'Word Pop',
  },
  {
    id: 'mrbeast',
    label: 'MrBeast',
    preview: 'text-white font-black',
    highlightClass: 'text-red-500 bg-red-500/20',
    baseScore: 14,
    animation: 'highlight',
    animLabel: 'Highlight',
  },
  {
    id: 'aliabdaal',
    label: 'Ali Abdaal',
    preview: 'text-blue-300 font-semibold',
    highlightClass: 'text-blue-300 bg-blue-300/20',
    baseScore: 8,
    animation: 'typewriter',
    animLabel: 'Typewriter',
  },
  {
    id: 'neon',
    label: 'Neon',
    preview: 'text-green-400 font-bold',
    highlightClass: 'text-green-400 bg-green-400/20',
    baseScore: 10,
    animation: 'glow',
    animLabel: 'Glow',
  },
  {
    id: 'bold',
    label: 'Bold',
    preview: 'text-white font-black text-lg',
    highlightClass: 'text-white bg-white/20',
    baseScore: 11,
    animation: 'pop',
    animLabel: 'Pop',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    preview: 'text-white/80 font-medium',
    highlightClass: 'text-white/80 bg-white/10',
    baseScore: 6,
    animation: 'highlight',
    animLabel: 'Highlight',
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
    id: 'pop-creator',
    label: 'Pop Creator',
    description: 'Purple background, white outline, pop effect',
    icon: '⚡',
    baseScore: 12,
    position: 'bottom-left',
  },
  {
    id: 'minimal-pro',
    label: 'Minimal Pro',
    description: 'Clean black, subtle Twitch logo',
    icon: '🧠',
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

  // Score caption styles based on clip characteristics
  const captionScores: ScoredOption[] = CAPTION_STYLES.map((s) => {
    let score = s.baseScore
    if (isHighEnergy && (s.id === 'mrbeast' || s.id === 'bold')) score += 6
    if (!isHighEnergy && (s.id === 'hormozi' || s.id === 'aliabdaal')) score += 4
    if (niche === 'irl' && s.id === 'hormozi') score += 5
    if (niche === 'gaming' && s.id === 'mrbeast') score += 5
    if (isMidEnergy && s.id === 'neon') score += 3
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

  // Score tag styles
  const tagScores: ScoredOption[] = TAG_STYLES.map((t) => {
    let score = t.baseScore
    if (t.id === 'viral-glow' && clip.author_handle) score += 5
    if (t.id === 'pop-creator') score += 2
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
  const bestCaption = captionScores.find((s) => s.isBest)?.id ?? captionScores[0]?.id ?? 'hormozi'
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
 * Baseline viral score for an unmodified clip, derived from its own metrics
 * (velocity, views, niche). A trending clip from the library should feel
 * "already somewhat viral" before the user touches anything — otherwise the
 * progress bar sits at 0/100 and feels punishing. Returns 10–30.
 */
export function computeBaselineScore(clip: TrendingClipData): number {
  const velocity = clip.velocity_score ?? 0
  const views = clip.view_count ?? 0

  let base = 10
  if (velocity >= 80 || views >= 5_000_000) base = 30
  else if (velocity >= 60 || views >= 1_000_000) base = 24
  else if (velocity >= 40 || views >= 250_000) base = 18
  else if (velocity >= 20 || views >= 50_000) base = 14

  // Tiny nudge: clips with a recognizable author_handle get +2 because
  // they're easier to credit, which marginally helps reach.
  if (clip.author_handle) base += 2

  return Math.min(30, base)
}

/**
 * Compute the current viral score based on user's enhancement settings.
 * Combines a baseline (from clip metrics) with the modifications score
 * (captions, emphasis, b-roll, tags). The modifications score is scaled
 * so that baseline + modifications can never exceed 100.
 *
 *   total = baseline + modifications * ((100 - baseline) / 100)
 *
 * So a clip with baseline=20 starts at 20 and maxes at 100, a clip with
 * baseline=30 starts at 30 and still maxes at 100. The user always sees
 * an upward trajectory from their first interaction.
 */
export function computeCurrentScore(
  settings: EnhanceSettings,
  scores: ComputedScores,
  baseline = 0
): number {
  const cs = scores.captionScores.find((s) => s.id === settings.captionStyle)?.score ?? 0
  const es = scores.emphasisScores.find((s) => s.id === settings.emphasisEffect)?.score ?? 0
  const bs = settings.splitScreenEnabled ? (scores.brollScores.find((s) => s.id === settings.brollVideo)?.score ?? 0) : 0
  const ts = scores.tagScores.find((s) => s.id === settings.tagStyle)?.score ?? 0
  const modifications = (settings.captionsEnabled ? cs + es : 0) + bs + ts

  if (baseline <= 0) return Math.min(100, modifications)

  const headroom = Math.max(0, 100 - baseline)
  const scaledMods = (modifications / 100) * headroom
  return Math.min(100, Math.round(baseline + scaledMods))
}

// ─── Score Label ────────────────────────────────────────────────────────────

/**
 * Get a human-readable label and color for a viral score.
 */
export function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: 'High chance to blow up', color: 'text-orange-400' }
  if (score >= 75) return { text: 'Very viral', color: 'text-green-400' }
  if (score >= 50) return { text: 'Good potential', color: 'text-blue-400' }
  if (score >= 30) return { text: 'Needs improvement', color: 'text-yellow-400' }
  return { text: 'Low viral score', color: 'text-muted-foreground' }
}
