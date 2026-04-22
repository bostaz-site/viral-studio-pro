-- Creator Ranking System — Phase 1 (YouTube)
-- Adds account_snapshots table and new columns to social_accounts

-- ── account_snapshots ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.account_snapshots (
    id SERIAL PRIMARY KEY,
    account_id UUID NOT NULL,
    platform TEXT NOT NULL,
    followers INTEGER,
    total_views BIGINT,
    video_count INTEGER,
    avg_views_per_video FLOAT,
    median_views_per_video FLOAT,
    engagement_rate FLOAT,
    creator_score FLOAT,
    creator_rank TEXT,
    snapshot_type TEXT DEFAULT 'daily' CHECK (snapshot_type IN ('daily', 'weekly')),
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_snapshots_account
    ON public.account_snapshots(account_id, captured_at DESC);

-- ── social_accounts — new columns for creator scoring ────────────────────────

ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS total_views BIGINT DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS avg_views_per_video FLOAT DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS median_views_per_video FLOAT DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS engagement_rate FLOAT DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS creator_score FLOAT DEFAULT NULL;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS creator_rank TEXT DEFAULT NULL;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS primary_niche TEXT DEFAULT NULL;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS sync_count_today INTEGER DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS last_sync_date DATE DEFAULT NULL;
