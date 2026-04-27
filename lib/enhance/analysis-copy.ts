/**
 * AI Analysis Copy — justification strings & fake dynamic data generators.
 *
 * These are displayed during the animated analysis sequence to make
 * mood-based presets feel like deep per-clip AI decisions.
 *
 * Nothing here affects the actual analysis — it's purely UX copy.
 */

import type { ClipMood } from '@/lib/ai/mood-presets'

// ── Justification Map ──────────────────────────────────────────────────────
// { mood → { parameter → reason string } }

export const JUSTIFICATIONS: Record<ClipMood, {
  captionStyle: string
  emphasisEffect: string
  emphasisColor: string
  hook: string
  zoom: string
}> = {
  rage: {
    captionStyle: 'maximizes impact during intense moments',
    emphasisEffect: 'amplifies key reactions for retention',
    emphasisColor: 'high contrast on dark backgrounds',
    hook: 'optimized for shock-value retention',
    zoom: 'tight framing captures raw energy',
  },
  funny: {
    captionStyle: 'matches comedic timing and punchlines',
    emphasisEffect: 'highlights punchlines naturally',
    emphasisColor: 'draws attention without competing with humor',
    hook: 'optimized for curiosity and replay value',
    zoom: 'captures facial reactions and timing',
  },
  drama: {
    captionStyle: 'builds tension with controlled reveals',
    emphasisEffect: 'subtle emphasis keeps focus on narrative',
    emphasisColor: 'creates atmospheric visual depth',
    hook: 'engineered for suspense and watch-through',
    zoom: 'slow focus shifts build dramatic weight',
  },
  wholesome: {
    captionStyle: 'clean readability for emotional moments',
    emphasisEffect: 'gentle emphasis preserves authenticity',
    emphasisColor: 'warm tone matches emotional content',
    hook: 'tuned for emotional connection',
    zoom: 'wide framing captures full reactions',
  },
  hype: {
    captionStyle: 'maximizes energy on peak moments',
    emphasisEffect: 'punchy scale matches adrenaline',
    emphasisColor: 'high-energy contrast drives engagement',
    hook: 'optimized for instant excitement',
    zoom: 'dynamic framing matches fast action',
  },
  story: {
    captionStyle: 'smooth flow for narrative pacing',
    emphasisEffect: 'minimal distraction keeps focus on story',
    emphasisColor: 'neutral tone supports long-form attention',
    hook: 'engineered for watch-through completion',
    zoom: 'steady framing supports monologue flow',
  },
}

// ── Emphasis Color Display Names ───────────────────────────────────────────

export const COLOR_DISPLAY_NAMES: Record<string, string> = {
  red: 'Impact Red',
  yellow: 'Neon Yellow',
  cyan: 'Electric Cyan',
  green: 'Vivid Green',
  orange: 'Blaze Orange',
  pink: 'Hot Pink',
  purple: 'Neon Purple',
  white: 'Clean White',
}

// ── Caption Style Display Names ────────────────────────────────────────────

export const CAPTION_DISPLAY_NAMES: Record<string, string> = {
  'word-pop': 'Word Pop',
  highlight: 'Highlight',
  bounce: 'Bounce',
  glow: 'Glow',
  none: 'None',
}

// ── Emphasis Effect Display Names ──────────────────────────────────────────

export const EFFECT_DISPLAY_NAMES: Record<string, string> = {
  scale: 'Scale Up',
  bounce: 'Bounce',
  glow: 'Glow',
  none: 'None',
}

// ── Fake Dynamic Data ──────────────────────────────────────────────────────
// Seeded by clip properties so values stay consistent per clip.

function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return () => {
    h = (h * 16807) % 2147483647
    return (h & 0x7fffffff) / 2147483647
  }
}

export interface AnalysisDynamicData {
  audioDuration: number
  peaksDetected: number
  keyMomentTimestamp: string
  highEnergySegments: number
}

export function generateDynamicData(
  clipId: string,
  durationSeconds: number | null | undefined
): AnalysisDynamicData {
  const duration = durationSeconds ?? 30
  const rng = seededRandom(clipId)

  const peaks = Math.floor(duration / 8) + Math.floor(rng() * 3) + 1
  const keyMomentSec = Math.floor(duration * (0.25 + rng() * 0.5))
  const minutes = Math.floor(keyMomentSec / 60)
  const seconds = keyMomentSec % 60
  const keyMomentTimestamp = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `0:${seconds.toString().padStart(2, '0')}`
  const segments = Math.max(2, Math.floor(duration / 6) + Math.floor(rng() * 2))

  return {
    audioDuration: Math.round(duration),
    peaksDetected: peaks,
    keyMomentTimestamp,
    highEnergySegments: segments,
  }
}

// ── Confidence Label ───────────────────────────────────────────────────────

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 75) return 'High'
  if (confidence >= 50) return 'Good'
  return 'Moderate'
}
