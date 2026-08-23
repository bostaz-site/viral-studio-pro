-- Render Contract: tracks which features were requested vs applied per render.
-- Enables detection of silently failing features (e.g. voiceover never applied).

-- Add contract column to render_jobs
ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS contract JSONB DEFAULT NULL;

-- Add 'degraded' to the status CHECK constraint.
-- A degraded render succeeded (file produced) but a critical user-requested
-- feature was missing (voiceover, captions, hook). Triggers auto-refund.
ALTER TABLE public.render_jobs
  DROP CONSTRAINT IF EXISTS render_jobs_status_check;

ALTER TABLE public.render_jobs
  ADD CONSTRAINT render_jobs_status_check
  CHECK (status IN ('pending', 'queued', 'rendering', 'done', 'degraded', 'error', 'failed', 'canceled', 'expired'));

-- Index for admin analytics: recent contracts with degraded status
CREATE INDEX IF NOT EXISTS idx_render_jobs_contract_degraded
  ON public.render_jobs (created_at DESC)
  WHERE status = 'degraded';

COMMENT ON COLUMN public.render_jobs.contract IS 'Feature contract: [{feature, requested, applied, reason, meta}]. Tracks what was requested vs what was actually rendered.';
