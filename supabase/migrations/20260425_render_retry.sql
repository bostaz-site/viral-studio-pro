-- Add retry support and expanded status set to render_jobs
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 2;

-- Allow 'failed' (dead-letter after max retries) and 'cancelled' (force re-render)
-- No CHECK constraint on render_jobs.status (uses free-form TEXT), so no ALTER needed.
-- Types enforced at application level via types/enums.ts RenderStatus.
