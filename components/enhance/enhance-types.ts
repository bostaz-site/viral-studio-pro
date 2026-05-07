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
}

export interface HookAnalysis {
  peak: { peakTime: number; peakScore: number; scores: number[]; windowSize: number }
  hooks: HookVariant[]
  reorder: { segments: { start: number; end: number; duration: number; label: string }[]; totalDuration: number; peakTime: number }
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
