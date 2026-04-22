-- Stratified cron: next_check_at column for priority-based rescoring

ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_trending_next_check ON public.trending_clips(next_check_at ASC NULLS FIRST);
