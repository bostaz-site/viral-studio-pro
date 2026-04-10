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
}

export type SortOption = 'velocity' | 'views' | 'date'

export interface TrendingFiltersState {
  search: string
  games: string[]
  platforms: string[]
  sort: SortOption
}

export interface ViralNotification {
  id: string
  clipTitle: string
  platform: string
  velocityScore: number
  timestamp: string
}
