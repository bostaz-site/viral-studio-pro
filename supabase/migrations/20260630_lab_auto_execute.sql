-- Add auto_pr_url column for Lab auto-execute workflow
ALTER TABLE public.lab_deep_dives
  ADD COLUMN IF NOT EXISTS auto_pr_url TEXT;

-- Extend status constraint with new auto-execute states
ALTER TABLE public.lab_deep_dives
  DROP CONSTRAINT IF EXISTS lab_deep_dives_status_check;

ALTER TABLE public.lab_deep_dives
  ADD CONSTRAINT lab_deep_dives_status_check
  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'shipped', 'discarded', 'executing', 'pr_ready'));
