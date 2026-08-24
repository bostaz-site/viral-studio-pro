/**
 * AI Mood Presets — 6 mood-based enhancement configurations.
 *
 * Architecture:
 * - BASE_SETTINGS: values shared across all moods
 * - PLATFORM_THEME: tag/hook glow colors per streaming platform
 * - MOOD_PRESETS: each mood = BASE_SETTINGS + mood-specific overrides
 * - getMoodPresetForClip(): merges mood preset + platform theme
 */

export type ClipMood = 'rage' | 'funny' | 'drama' | 'wholesome' | 'hype' | 'story'

export interface MoodPreset {
  mood: ClipMood
  label: string
  emoji: string
  description: string

  // Maps to EnhanceSettings fields
  captionStyle: string
  wordsPerLine: number
  captionPosition: number

  emphasisEffect: string
  emphasisColor: string

  videoZoom: 'auto' | 'contain' | 'fill' | 'immersive' | 'fullframe' | 'fit' | 'reaction'

  tagStyle: string
  tagSize: number

  aspectRatio: '9:16'

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
  hookStyle: 'shock' | 'curiosity' | 'suspense'
  hookTextPosition: number
  hookLength: number

  voiceoverEnabled: boolean
}

// ── Base settings (shared by ALL moods) ─────────────────────────────────────

export const BASE_SETTINGS = {
  captionPosition: 75,
  tagSize: 85,
  aspectRatio: '9:16' as const,
  audioEnhanceEnabled: true,
  bassBoost: 'off' as const,
  speedRamp: 'off' as const,
  hookEnabled: true,
  hookTextEnabled: true,
  hookTextPosition: 18,
  hookLength: 0,
  smartZoomEnabled: true,
  voiceoverEnabled: true,
}

// ── Platform theme (tag + hook glow colors by platform) ─────────────────────

export const PLATFORM_THEME = {
  twitch: { tagStyle: 'credit-text', hookGlowColor: '#C77DFF' },
  kick: { tagStyle: 'credit-text', hookGlowColor: '#00E701' },
  youtube: { tagStyle: 'credit-text', hookGlowColor: '#FF0000' },
} as const

// ── Mood presets (BASE_SETTINGS + mood-specific overrides) ──────────────────

export const MOOD_PRESETS: Record<ClipMood, MoodPreset> = {
  rage: {
    mood: 'rage',
    label: 'Rage',
    emoji: '🔥',
    description: 'Max retention on raw shock — screaming, slamming, intense moments',
    ...BASE_SETTINGS,
    tagStyle: 'credit-text',
    captionStyle: 'word-pop',
    wordsPerLine: 1,
    emphasisEffect: 'scale',
    emphasisColor: 'red',
    videoZoom: 'auto',
    smartZoomMode: 'dynamic',
    bassBoost: 'off',
    speedRamp: 'dynamic',
    autoCutEnabled: true,
    autoCutThreshold: 1.2,
    hookReorderEnabled: true,
    hookStyle: 'shock',
    hookLength: 0,
  },

  funny: {
    mood: 'funny',
    label: 'Funny',
    emoji: '😂',
    description: 'Instant laughs — jokes, fails, funny reactions',
    ...BASE_SETTINGS,
    tagStyle: 'credit-text',
    captionStyle: 'bounce',
    wordsPerLine: 2,
    emphasisEffect: 'bounce',
    emphasisColor: 'yellow',
    videoZoom: 'auto',
    smartZoomMode: 'micro',
    speedRamp: 'subtle',
    autoCutEnabled: true,
    autoCutThreshold: 1.2,
    hookReorderEnabled: true,
    hookStyle: 'curiosity',
    hookLength: 0,
  },

  drama: {
    mood: 'drama',
    label: 'Drama',
    emoji: '🎭',
    description: 'Tension and confrontation — beef, accusations, intense moments',
    ...BASE_SETTINGS,
    tagStyle: 'credit-text',
    captionStyle: 'highlight',
    wordsPerLine: 2,
    emphasisEffect: 'glow',
    emphasisColor: 'purple',
    videoZoom: 'auto',
    smartZoomMode: 'follow',
    bassBoost: 'off',
    autoCutEnabled: true,
    autoCutThreshold: 1.2,
    hookReorderEnabled: true,
    hookStyle: 'suspense',
    hookLength: 0,
  },

  wholesome: {
    mood: 'wholesome',
    label: 'Wholesome',
    emoji: '✨',
    description: 'Touching moments — donations, gratitude, emotional reactions',
    ...BASE_SETTINGS,
    tagStyle: 'credit-text',
    captionStyle: 'glow',
    wordsPerLine: 4,
    emphasisEffect: 'none',
    emphasisColor: 'cyan',
    videoZoom: 'auto',
    smartZoomMode: 'micro',
    autoCutEnabled: true,
    autoCutThreshold: 1.2,
    hookReorderEnabled: false,
    hookStyle: 'curiosity',
    hookLength: 0,
  },

  hype: {
    mood: 'hype',
    label: 'Hype',
    emoji: '🏆',
    description: 'Pure adrenaline — victories, epic moments, crowd going wild',
    ...BASE_SETTINGS,
    tagStyle: 'credit-text',
    captionStyle: 'word-pop',
    wordsPerLine: 1,
    emphasisEffect: 'scale',
    emphasisColor: 'orange',
    videoZoom: 'auto',
    smartZoomMode: 'dynamic',
    bassBoost: 'off',
    speedRamp: 'dynamic',
    autoCutEnabled: true,
    autoCutThreshold: 1.2,
    hookReorderEnabled: true,
    hookStyle: 'shock',
    hookLength: 0,
  },

  story: {
    mood: 'story',
    label: 'Story',
    emoji: '🗣️',
    description: 'Narration and monologues — stories, rants, explanations',
    ...BASE_SETTINGS,
    tagStyle: 'credit-text',
    captionStyle: 'highlight',
    wordsPerLine: 5,
    emphasisEffect: 'none',
    emphasisColor: 'white',
    videoZoom: 'auto',
    smartZoomMode: 'micro',
    bassBoost: 'off',
    autoCutEnabled: true,
    autoCutThreshold: 0.7,
    hookReorderEnabled: false,
    hookStyle: 'suspense',
    hookLength: 0,
  },
}

// ── Helper: merge mood preset + platform theme ──────────────────────────────

/** Get a mood preset with platform-appropriate tag style */
export function getMoodPresetForClip(mood: ClipMood, platform: string): MoodPreset {
  const base = MOOD_PRESETS[mood]
  const theme = PLATFORM_THEME[platform as keyof typeof PLATFORM_THEME] ?? PLATFORM_THEME.twitch
  return { ...base, tagStyle: theme.tagStyle }
}

// ── Exports ─────────────────────────────────────────────────────────────────

export const ALL_MOODS: ClipMood[] = ['rage', 'funny', 'drama', 'wholesome', 'hype', 'story']

/** Mood glow colors for the selected button border */
export const MOOD_COLORS: Record<ClipMood, string> = {
  rage: 'border-red-500/60 shadow-red-500/20',
  funny: 'border-yellow-500/60 shadow-yellow-500/20',
  drama: 'border-orange-500/60 shadow-orange-500/20',
  wholesome: 'border-cyan-500/60 shadow-cyan-500/20',
  hype: 'border-blue-500/60 shadow-blue-500/20',
  story: 'border-purple-500/60 shadow-purple-500/20',
}
