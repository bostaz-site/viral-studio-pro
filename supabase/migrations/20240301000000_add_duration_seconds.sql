-- Add duration_seconds column to trending_clips for filtering by clip length
ALTER TABLE public.trending_clips
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Index for efficient duration range queries
CREATE INDEX IF NOT EXISTS idx_trending_clips_duration
  ON public.trending_clips (duration_seconds)
  WHERE duration_seconds IS NOT NULL;
