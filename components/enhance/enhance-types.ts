/**
 * Shared types for Enhance sub-components.
 * Prevents circular imports between the orchestrator and its children.
 */

import type { EnhanceSettings, ComputedScores, ScoreBreakdown, TrendingClipData } from '@/lib/enhance/scoring'
import type { ClipMood } from '@/lib/ai/mood-presets'

export interface HookVariant {
  style: string
  label: string
  text: string
  /** P4: white | yellow | red (derived from mood / style / breaking) */
  color?: 'white' | 'yellow' | 'red'
}

export interface HookAnalysis {
  peak: { peakTime: number; peakScore: number; scores: number[]; windowSize: number }
  hooks: HookVariant[]
  reorder: { segments: { start: number; end: number; duration: number; label: string }[]; totalDuration: number; peakTime: number }
  /** P4 · Copywriter SEO: niche keyword aligned between on-screen hook and description */
  niche_keyword?: string | null
  /** P4: true when a "breaking" framing was allowed (early_gem / hot_now, < 6h) */
  breaking?: boolean
  hook_color?: 'white' | 'yellow' | 'red'
}

/** Common props passed to accordion section sub-components */
export interface AccordionSectionProps {
  settings: EnhanceSettings
  updateSetting: <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => void
  scoreBreakdown: ScoreBreakdown
  hasAiAnalyzed: boolean
  analysisComplete: boolean
  moodAiDetected: boolean
  selectedMood: ClipMood | null
  detectedMood: ClipMood | null
  getRealImpact: (
    category: 'caption' | 'emphasis' | 'tag',
    optionId: string,
    bestId: string,
  ) => { impact: number; isMoodPick: boolean }
  getOptionPts: (weight: number) => number
  scores: ComputedScores | null
}

export type { EnhanceSettings, ComputedScores, ScoreBreakdown, TrendingClipData, ClipMood }
