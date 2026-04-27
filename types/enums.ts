// ── Clip Scoring ──
export const CLIP_TIERS = ['mega_viral', 'viral', 'hot', 'rising', 'normal', 'dead'] as const
export type ClipTier = typeof CLIP_TIERS[number]

export const CLIP_RANKS = ['common', 'rare', 'super_rare', 'epic', 'legendary', 'master'] as const
export type ClipRank = typeof CLIP_RANKS[number]

export const FEED_CATEGORIES = ['hot_now', 'early_gem', 'proven', 'normal'] as const
export type FeedCategory = typeof FEED_CATEGORIES[number]

// ── Platforms ──
export const PLATFORMS = ['twitch', 'kick', 'youtube_gaming'] as const
export type Platform = typeof PLATFORMS[number]

// ── Render Job ──
export const RENDER_STATUSES = ['pending', 'queued', 'rendering', 'done', 'error', 'failed', 'cancelled', 'expired'] as const
export type RenderStatus = typeof RENDER_STATUSES[number]

// ── Video ──
export const VIDEO_STATUSES = ['uploaded', 'processing', 'transcribing', 'analyzing', 'clipping', 'done', 'error'] as const
export type VideoStatus = typeof VIDEO_STATUSES[number]

// ── User Plans ──
export const PLANS = ['free', 'pro', 'studio'] as const
export type Plan = typeof PLANS[number]

// ── Creator Ranking ──
export const CREATOR_RANKS = ['newcomer', 'creator', 'trending_creator', 'viral_creator', 'elite_creator', 'legendary', 'hidden_gem'] as const
export type CreatorRank = typeof CREATOR_RANKS[number]
