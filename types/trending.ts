import type { ClipRank, FeedCategory } from '@/types/enums'

export type { ClipRank, FeedCategory }

export interface TrendingClip {
  id: string
  external_url: string
  platform: string
  author_name: string | null
  author_handle: string | null
  title: string | null
  description: string | null
  niche: string | null
  view_count: number | null
  like_count: number | null
  velocity_score: number | null
  thumbnail_url: string | null
  scraped_at: string | null
  created_at: string | null
  duration_seconds: number | null
  velocity: number | null
  viral_ratio: number | null
  viral_score: number | null
  clip_created_at: string | null
  streamer_id: string | null
  twitch_clip_id: string | null
  tier: string | null
  // V2 fields
  early_signal_score: number | null
  anomaly_score: number | null
  feed_category: FeedCategory | null
  // V2 sub-scores
  momentum_score: number | null
  engagement_score: number | null
  recency_score: number | null
  format_score: number | null
  saturation_score: number | null
  // Momentum decay/acceleration
  prev_momentum_score?: number | null
  // Social proof
  export_count?: number | null
  // Stream grouping (added by API, not in DB)
  stream_group_id?: string | null
  stream_group_count?: number | null
  stream_group_collapsed?: boolean
}

/** Derive rank from the DB tier column or velocity_score */
export function clipRank(clip: TrendingClip): ClipRank {
  const score = clip.velocity_score ?? 0
  if (score >= 95) return 'master'
  if (score >= 80) return 'legendary'
  if (score >= 65) return 'epic'
  if (score >= 45) return 'super_rare'
  if (score >= 25) return 'rare'
  return 'common'
}

/** Generate a contextual insight explaining why a clip scores well */
export function getClipInsight(clip: TrendingClip): { icon: string; text: string } | null {
  if ((clip.momentum_score ?? 0) >= 65) return { icon: '\u{1f525}', text: 'High momentum' }
  if (clip.feed_category === 'early_gem') return { icon: '\u{1f48e}', text: 'Early gem' }
  if ((clip.early_signal_score ?? 0) >= 50) return { icon: '\u26a1', text: 'Spike detected' }
  if ((clip.anomaly_score ?? 0) >= 70) return { icon: '\u{1f4c8}', text: 'Outperforms streamer avg' }
  if ((clip.engagement_score ?? 0) >= 75) return { icon: '\u2764\ufe0f', text: 'High engagement' }
  if (clip.format_score === 100) return { icon: '\u{1f3af}', text: 'Perfect format' }
  return null
}

export interface SavedClip {
  id: string
  clip_id: string
  notes: string | null
  created_at: string
  trending_clips: TrendingClip | null
}

export interface TrendingStats {
  total: number
  viral: number
  hot: number
  topGame: string | null
  topPlatform: string | null
  avgVelocity: number
  platforms: Record<string, number>
  games: Record<string, number>
  lastScrapedAt: string | null
  // V2 feed counts
  hotNowCount: number
  earlyGemCount: number
  provenCount: number
  // Rank counts
  rankCounts: Record<ClipRank, number>
}

export type SortOption = 'velocity' | 'date'
export type DurationFilter = 'all' | 'short' | 'medium' | 'long'
export type FeedFilter = 'all' | 'hot_now' | 'early_gem' | 'proven' | 'recent' | 'saved' | 'remixes'

export interface TrendingFiltersState {
  search: string
  games: string[]
  platforms: string[]
  sort: SortOption
  duration: DurationFilter
  feed: FeedFilter
}

export interface ViralNotification {
  id: string
  clipTitle: string
  platform: string
  velocityScore: number
  timestamp: string
}
