-- Clip Bank: persist removals in DB instead of sessionStorage.
-- NULL = clip is in the bank. Non-NULL = removed at that timestamp.

ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS removed_from_bank_at TIMESTAMPTZ DEFAULT NULL;

-- Index for the clip bank query: only show non-removed, done jobs
CREATE INDEX IF NOT EXISTS idx_render_jobs_bank
  ON public.render_jobs (user_id, status, created_at DESC)
  WHERE status = 'done' AND removed_from_bank_at IS NULL;
