-- Candidate check columns on trending_clips
-- Stores pre-render analysis results to avoid re-checking the same clip twice.
ALTER TABLE public.trending_clips
  ADD COLUMN IF NOT EXISTS candidate_flags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS candidate_metrics JSONB,
  ADD COLUMN IF NOT EXISTS candidate_checked_at TIMESTAMPTZ;
