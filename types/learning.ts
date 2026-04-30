/* ─── Learning Engine Types ───
 * Types for the Analytics Learning Engine.
 * Used by analytics-dashboard.tsx and future learning loop integrations.
 */

export type ConfidenceLevel = 'none' | 'collecting' | 'early' | 'medium' | 'high'

export function getConfidenceLevel(postCount: number): ConfidenceLevel {
  if (postCount === 0) return 'none'
  if (postCount < 5) return 'collecting'
  if (postCount < 15) return 'early'
  if (postCount < 30) return 'medium'
  return 'high'
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'none': return 'No data'
    case 'collecting': return 'Collecting signals'
    case 'early': return 'Early signals'
    case 'medium': return 'Medium confidence'
    case 'high': return 'High confidence'
  }
}

export function getMinPostsForInsight(): number {
  return 5
}

export interface PublishedPostPerformance {
  id: string
  user_id: string
  clip_id: string
  render_job_id: string
  platform: 'tiktok' | 'youtube' | 'instagram'
  account_id: string
  account_handle?: string
  platform_post_id?: string
  published_at: string
  posted_hour_local: number
  posted_weekday: number
  // Metrics (filled when API available)
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves?: number | null
  watch_time_avg?: number | null
  retention_rate?: number | null
  // Clip metadata at publish time
  clip_mood: string
  caption_style: string
  caption_tone?: string
  hook_style: string
  hook_enabled: boolean
  split_screen_enabled: boolean
  smart_zoom_mode: string
  duration_seconds: number
  blowup_chance_at_render?: number
  algo_score_at_pick?: number
  source_platform: string
  source_streamer?: string
  niche?: string
}

export interface LearnedInsight {
  platform: string
  pattern: string
  multiplier: number
  postCount: number
  confidence: ConfidenceLevel
}

export interface LearnedAdjustment {
  change: string
  reason: string
  confidence: ConfidenceLevel
}

export interface AccountBreakdown {
  accountId: string
  platform: string
  username: string | null
  postsAnalyzed: number
  bestMood: { mood: string; multiplier: number; postCount: number } | null
  bestTime: { window: string; multiplier: number; postCount: number } | null
  bestFormat: { format: string; multiplier: number; postCount: number } | null
  avoid: { pattern: string; penalty: number; postCount: number } | null
  confidence: ConfidenceLevel
  hasApiTracking: boolean
  // YouTube-specific (WIRED_REAL)
  creatorScore?: number
  creatorRank?: string
}

export interface LearnedDistributionProfile {
  bestMoodsByPlatform: Record<string, { mood: string; multiplier: number; postCount: number }[]>
  bestPostingWindows: { platform: string; accountId: string; startHour: number; endHour: number; multiplier: number; postCount: number }[]
  bestCaptionStyles: { platform: string; style: string; multiplier: number; postCount: number }[]
  underperformingPatterns: { platform: string; pattern: string; penalty: number; postCount: number }[]
  adjustments: LearnedAdjustment[]
  confidence: ConfidenceLevel
  totalPostsAnalyzed: number
  lastUpdated: string
}
