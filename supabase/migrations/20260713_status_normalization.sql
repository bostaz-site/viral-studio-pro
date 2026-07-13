-- Status normalization: canonical spelling + CHECK constraints
-- render_jobs: pending | queued | rendering | done | error | failed | canceled | expired
-- scheduled_publications: scheduled | publishing | published | failed | canceled

-- 1. Normalize existing data
UPDATE public.render_jobs SET status = 'canceled' WHERE status = 'cancelled';
UPDATE public.scheduled_publications SET status = 'canceled' WHERE status = 'cancelled';

-- 2. Drop old CHECK constraint on render_jobs (from 20260425_expired_status.sql)
ALTER TABLE public.render_jobs DROP CONSTRAINT IF EXISTS render_jobs_status_check;

-- 3. Drop old CHECK constraint on scheduled_publications (from 20260421_distribution_hub.sql)
ALTER TABLE public.scheduled_publications DROP CONSTRAINT IF EXISTS scheduled_publications_status_check;

-- 4. Add canonical CHECK constraints
ALTER TABLE public.render_jobs
  ADD CONSTRAINT render_jobs_status_check
  CHECK (status IN ('pending', 'queued', 'rendering', 'done', 'error', 'failed', 'canceled', 'expired'));

ALTER TABLE public.scheduled_publications
  ADD CONSTRAINT scheduled_publications_status_check
  CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'canceled'));
