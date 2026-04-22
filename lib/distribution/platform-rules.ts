// Platform-specific rules for smart publishing decisions

export interface PlatformRules {
  name: string
  max_safe_posts_per_day: number
  min_posts_per_day: number
  optimal_posts_per_day: number
  min_hours_between_posts: number
  critical_window_hours: number
  viral_cooldown_hours: number
  flop_recovery_hours: number
  hashtag_impact: 'high' | 'medium' | 'low'
  best_clip_duration: { min: number; max: number }
  algo_push_duration_hours: number
  default_optimal_hours: number[]
}

export const PLATFORM_RULES: Record<string, PlatformRules> = {
  tiktok: {
    name: 'TikTok',
    max_safe_posts_per_day: 3,
    min_posts_per_day: 1,
    optimal_posts_per_day: 2,
    min_hours_between_posts: 3,
    critical_window_hours: 2,
    viral_cooldown_hours: 12,
    flop_recovery_hours: 4,
    hashtag_impact: 'low',
    best_clip_duration: { min: 15, max: 45 },
    algo_push_duration_hours: 6,
    default_optimal_hours: [12, 17, 21],
  },
  youtube: {
    name: 'YouTube Shorts',
    max_safe_posts_per_day: 3,
    min_posts_per_day: 1,
    optimal_posts_per_day: 2,
    min_hours_between_posts: 4,
    critical_window_hours: 4,
    viral_cooldown_hours: 24,
    flop_recovery_hours: 6,
    hashtag_impact: 'medium',
    best_clip_duration: { min: 15, max: 60 },
    algo_push_duration_hours: 48,
    default_optimal_hours: [14, 20],
  },
  instagram: {
    name: 'Instagram Reels',
    max_safe_posts_per_day: 1,
    min_posts_per_day: 1,
    optimal_posts_per_day: 1,
    min_hours_between_posts: 24,
    critical_window_hours: 6,
    viral_cooldown_hours: 24,
    flop_recovery_hours: 24,
    hashtag_impact: 'high',
    best_clip_duration: { min: 15, max: 30 },
    algo_push_duration_hours: 72,
    default_optimal_hours: [13, 18, 21],
  },
}

export function getPlatformRules(platform: string): PlatformRules {
  return PLATFORM_RULES[platform] ?? PLATFORM_RULES.tiktok
}
