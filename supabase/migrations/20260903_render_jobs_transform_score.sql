-- transform_score: 0-3 count of applied transformation features (hook_text, captions, smart_zoom).
-- Written by the VPS at render completion (vps/routes/render.js) and read by the
-- quality gate (smart-publisher) to decide auto-publish eligibility.
--
-- NOTE: the column was referenced in code since commit 881c24b (2026-09-01) without a
-- migration, which made EVERY final render_jobs update fail silently (PostgREST rejects
-- unknown columns) → the VPS safety net then forced successful renders to 'error'.

ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS transform_score SMALLINT
  CHECK (transform_score IS NULL OR (transform_score >= 0 AND transform_score <= 4));

CREATE INDEX IF NOT EXISTS idx_render_jobs_transform_score
  ON public.render_jobs (transform_score)
  WHERE transform_score IS NOT NULL;

COMMENT ON COLUMN public.render_jobs.transform_score IS
  'Count of applied transformation features (hook_text, captions, smart_zoom). Used by the auto-publish quality gate.';
