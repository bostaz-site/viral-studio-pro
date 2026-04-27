-- Ajouter 'expired' au CHECK constraint de render_jobs.status
ALTER TABLE public.render_jobs
  DROP CONSTRAINT IF EXISTS render_jobs_status_check;

ALTER TABLE public.render_jobs
  ADD CONSTRAINT render_jobs_status_check
  CHECK (status IN ('pending', 'queued', 'rendering', 'done', 'error', 'failed', 'cancelled', 'expired'));

-- Backfill les jobs deja expires (done + storage_path NULL + > 1 jour)
UPDATE public.render_jobs
SET status = 'expired'
WHERE status = 'done'
  AND storage_path IS NULL
  AND updated_at < NOW() - INTERVAL '1 day';
