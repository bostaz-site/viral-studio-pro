ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_render_jobs_idempotency
ON render_jobs (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
