-- Autofarm executor: add columns for TikTok options, retry tracking, and auto-post defaults

-- scheduled_publications: add tiktok_options, retry_count, source
ALTER TABLE public.scheduled_publications
  ADD COLUMN IF NOT EXISTS tiktok_options JSONB,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'autofarm'));

-- distribution_settings: add auto_post_defaults (TikTok compliance defaults configured once by user)
ALTER TABLE public.distribution_settings
  ADD COLUMN IF NOT EXISTS auto_post_defaults JSONB;

-- Index for cron executor: find due scheduled publications efficiently
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_due
  ON public.scheduled_publications (scheduled_at)
  WHERE status = 'scheduled';
