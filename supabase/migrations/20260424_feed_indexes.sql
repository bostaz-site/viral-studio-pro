-- Feed indexes for cursor pagination and filtering
-- These support the /api/trending endpoint with cursor-based pagination

-- Index for cursor pagination by velocity_score (default sort)
CREATE INDEX IF NOT EXISTS idx_trending_clips_velocity_cursor
ON trending_clips (velocity_score DESC, id DESC);

-- Index for cursor pagination by date
CREATE INDEX IF NOT EXISTS idx_trending_clips_date_cursor
ON trending_clips (created_at DESC, id DESC);

-- Index for filtering by feed_category
CREATE INDEX IF NOT EXISTS idx_trending_clips_feed_category
ON trending_clips (feed_category) WHERE feed_category IS NOT NULL;

-- Index for filtering by platform
CREATE INDEX IF NOT EXISTS idx_trending_clips_platform
ON trending_clips (platform);

-- Index for filtering by niche
CREATE INDEX IF NOT EXISTS idx_trending_clips_niche
ON trending_clips (niche) WHERE niche IS NOT NULL;

-- Index for the cron rescore (next_check_at)
CREATE INDEX IF NOT EXISTS idx_trending_clips_next_check
ON trending_clips (next_check_at) WHERE next_check_at IS NOT NULL;

-- Trigram index for text search on title/author
-- Requires pg_trgm extension (available on Supabase by default)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_trending_clips_title_trgm
ON trending_clips USING gin (title gin_trgm_ops);
