-- Learning loop fix: persist render settings on render_jobs + add cron tracking cols to published_posts.

-- 1. Store render settings on render_jobs so publish can auto-resolve metadata
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS render_settings JSONB;

-- 2. Add cron tracking columns to published_posts for observable stats refresh
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS check_count INTEGER NOT NULL DEFAULT 0;
