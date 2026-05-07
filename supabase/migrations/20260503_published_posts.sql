-- Learning Engine foundation: published_posts table
-- Stores a snapshot of clip metadata + settings at publish time,
-- plus performance metrics (filled later when API tracking is available).

CREATE TABLE IF NOT EXISTS public.published_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id TEXT NOT NULL,
    render_job_id UUID REFERENCES public.render_jobs(id) ON DELETE SET NULL,

    -- Platform + account
    platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'instagram')),
    account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
    account_handle TEXT,
    platform_post_id TEXT, -- ID returned by the platform API after publish

    -- Timing
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_hour_local INTEGER CHECK (posted_hour_local >= 0 AND posted_hour_local <= 23),
    posted_weekday INTEGER CHECK (posted_weekday >= 0 AND posted_weekday <= 6),

    -- Performance metrics (null until API tracking is approved)
    views BIGINT,
    likes BIGINT,
    comments BIGINT,
    shares BIGINT,
    saves BIGINT,
    watch_time_avg FLOAT,
    retention_rate FLOAT,

    -- Clip metadata snapshot at publish time (for pattern detection)
    clip_mood TEXT,
    caption_style TEXT,
    caption_tone TEXT,
    hook_style TEXT,
    hook_enabled BOOLEAN,
    split_screen_enabled BOOLEAN,
    smart_zoom_mode TEXT,
    duration_seconds FLOAT,
    blowup_chance_at_render FLOAT,
    algo_score_at_pick FLOAT,
    source_platform TEXT,
    source_streamer TEXT,
    niche TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: user-scoped access only
ALTER TABLE public.published_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own published posts"
    ON public.published_posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own published posts"
    ON public.published_posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own published posts"
    ON public.published_posts FOR UPDATE
    USING (auth.uid() = user_id);

-- Indexes for Learning Engine queries
CREATE INDEX idx_published_posts_user_date
    ON public.published_posts (user_id, published_at DESC);

CREATE INDEX idx_published_posts_user_platform_mood
    ON public.published_posts (user_id, platform, clip_mood);

CREATE INDEX idx_published_posts_user_platform_hour
    ON public.published_posts (user_id, platform, posted_hour_local);

CREATE INDEX idx_published_posts_platform_post_id
    ON public.published_posts (platform_post_id)
    WHERE platform_post_id IS NOT NULL;
