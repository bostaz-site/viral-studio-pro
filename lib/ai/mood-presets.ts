/**
 * AI Mood Presets — 6 mood-based enhancement configurations.
 * Each preset maps exactly to the EnhanceSettings state in the Enhance page.
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

  brollVideo: string
  splitRatio: number

  videoZoom: 'contain' | 'fill' | 'immersive'

  tagStyle: string
  tagSize: number

  aspectRatio: '9:16'

  smartZoomEnabled: boolean
  smartZoomMode: 'micro' | 'dynamic' | 'follow'

  audioEnhanceEnabled: boolean

  autoCutEnabled: boolean
  autoCutThreshold: number

  hookEnabled: boolean
  hookTextEnabled: boolean
  hookReorderEnabled: boolean
  hookStyle: 'choc' | 'curiosite' | 'suspense'
  hookTextPosition: number
  hookLength: number
}

export const MOOD_PRESETS: Record<ClipMood, MoodPreset> = {
  rage: {
    mood: 'rage',
    label: 'Rage',
    emoji: '🔥',
    description: 'Max retention on raw shock — screaming, slamming, intense moments',
    captionStyle: 'mrbeast',
    wordsPerLine: 1,
    captionPosition: 42,
    emphasisEffect: 'scale',
    emphasisColor: 'red',
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'fill',
    tagStyle: 'viral-glow',
    tagSize: 85,
    aspectRatio: '9:16',
    smartZoomEnabled: true,
    smartZoomMode: 'dynamic',
    audioEnhanceEnabled: true,
    autoCutEnabled: true,
    autoCutThreshold: 0.5,
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookStyle: 'choc',
    hookTextPosition: 15,
    hookLength: 1,
  },

  funny: {
    mood: 'funny',
    label: 'Funny',
    emoji: '😂',
    description: 'Instant laughs — jokes, fails, funny reactions',
    captionStyle: 'hormozi-purple',
    wordsPerLine: 2,
    captionPosition: 42,
    emphasisEffect: 'bounce',
    emphasisColor: 'yellow',
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'fill',
    tagStyle: 'pop-creator',
    tagSize: 85,
    aspectRatio: '9:16',
    smartZoomEnabled: true,
    smartZoomMode: 'micro',
    audioEnhanceEnabled: true,
    autoCutEnabled: false,
    autoCutThreshold: 0.7,
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookStyle: 'curiosite',
    hookTextPosition: 15,
    hookLength: 1.5,
  },

  drama: {
    mood: 'drama',
    label: 'Drama',
    emoji: '🎭',
    description: 'Tension and confrontation — beef, accusations, intense moments',
    captionStyle: 'bold',
    wordsPerLine: 2,
    captionPosition: 42,
    emphasisEffect: 'glow',
    emphasisColor: 'orange',
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'immersive',
    tagStyle: 'viral-glow',
    tagSize: 85,
    aspectRatio: '9:16',
    smartZoomEnabled: true,
    smartZoomMode: 'follow',
    audioEnhanceEnabled: true,
    autoCutEnabled: false,
    autoCutThreshold: 0.7,
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookStyle: 'suspense',
    hookTextPosition: 15,
    hookLength: 2,
  },

  wholesome: {
    mood: 'wholesome',
    label: 'Wholesome',
    emoji: '✨',
    description: 'Touching moments — donations, gratitude, emotional reactions',
    captionStyle: 'minimal',
    wordsPerLine: 4,
    captionPosition: 42,
    emphasisEffect: 'none',
    emphasisColor: 'white',
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'contain',
    tagStyle: 'minimal-pro',
    tagSize: 85,
    aspectRatio: '9:16',
    smartZoomEnabled: true,
    smartZoomMode: 'micro',
    audioEnhanceEnabled: true,
    autoCutEnabled: false,
    autoCutThreshold: 0.7,
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: false,
    hookStyle: 'curiosite',
    hookTextPosition: 15,
    hookLength: 1.5,
  },

  hype: {
    mood: 'hype',
    label: 'Hype',
    emoji: '🏆',
    description: 'Pure adrenaline — victories, epic moments, crowd going wild',
    captionStyle: 'neon',
    wordsPerLine: 1,
    captionPosition: 42,
    emphasisEffect: 'scale',
    emphasisColor: 'cyan',
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'fill',
    tagStyle: 'pop-creator',
    tagSize: 85,
    aspectRatio: '9:16',
    smartZoomEnabled: true,
    smartZoomMode: 'dynamic',
    audioEnhanceEnabled: true,
    autoCutEnabled: true,
    autoCutThreshold: 0.5,
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookStyle: 'choc',
    hookTextPosition: 15,
    hookLength: 1,
  },

  story: {
    mood: 'story',
    label: 'Story',
    emoji: '🗣️',
    description: 'Narration and monologues — stories, rants, explanations',
    captionStyle: 'aliabdaal',
    wordsPerLine: 5,
    captionPosition: 42,
    emphasisEffect: 'none',
    emphasisColor: 'white',
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'contain',
    tagStyle: 'minimal-pro',
    tagSize: 85,
    aspectRatio: '9:16',
    smartZoomEnabled: true,
    smartZoomMode: 'micro',
    audioEnhanceEnabled: true,
    autoCutEnabled: true,
    autoCutThreshold: 0.7,
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: false,
    hookStyle: 'suspense',
    hookTextPosition: 15,
    hookLength: 2,
  },
}

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
