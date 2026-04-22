-- Smart Publishing System: performance tracking + account intelligence
-- Migration: 20260421_smart_publishing

-- ============================================================
-- 1. Publication Performance Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.publication_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_publication_id UUID REFERENCES public.scheduled_publications(id) ON DELETE SET NULL,
    clip_id TEXT NOT NULL,
    platform TEXT NOT NULL,

    -- Metrics collected over time
    views_1h INTEGER DEFAULT 0,
    views_2h INTEGER DEFAULT 0,
    views_6h INTEGER DEFAULT 0,
    views_24h INTEGER DEFAULT 0,
    views_48h INTEGER DEFAULT 0,
    views_total INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    watch_time_avg FLOAT,
    retention_rate FLOAT,

    -- Metadata
    posted_at TIMESTAMPTZ NOT NULL,
    day_of_week INTEGER,
    hour_of_day INTEGER,
    niche TEXT,
    has_captions BOOLEAN DEFAULT FALSE,
    has_split_screen BOOLEAN DEFAULT FALSE,
    clip_duration_seconds FLOAT,

    -- Calculated performance
    performance_score FLOAT,
    is_viral BOOLEAN DEFAULT FALSE,
    velocity FLOAT,

    -- Check status
    last_checked_at TIMESTAMPTZ,
    check_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for publication_performance
CREATE INDEX IF NOT EXISTS idx_pub_perf_user_id ON public.publication_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_pub_perf_platform ON public.publication_performance(platform);
CREATE INDEX IF NOT EXISTS idx_pub_perf_posted_at ON public.publication_performance(posted_at);
CREATE INDEX IF NOT EXISTS idx_pub_perf_day_of_week ON public.publication_performance(day_of_week);
CREATE INDEX IF NOT EXISTS idx_pub_perf_hour_of_day ON public.publication_performance(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_pub_perf_user_platform ON public.publication_performance(user_id, platform);

-- RLS for publication_performance
ALTER TABLE public.publication_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own performance data"
    ON public.publication_performance FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own performance data"
    ON public.publication_performance FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own performance data"
    ON public.publication_performance FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own performance data"
    ON public.publication_performance FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- 2. Account Intelligence (learning per account)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    platform TEXT NOT NULL,

    -- Account phase
    phase TEXT DEFAULT 'testing' CHECK (phase IN ('testing', 'optimizing', 'scaling')),
    total_posts INTEGER DEFAULT 0,

    -- Best/worst time slots discovered
    best_hours JSONB DEFAULT '[]',
    worst_hours JSONB DEFAULT '[]',

    -- Optimal frequency discovered
    optimal_posts_per_day FLOAT,
    optimal_min_hours_between FLOAT,

    -- Detected patterns
    best_clip_duration_range JSONB,
    captions_boost_percent FLOAT,
    split_screen_boost_percent FLOAT,

    -- Current state
    last_post_performance TEXT,
    last_post_at TIMESTAMPTZ,
    consecutive_flops INTEGER DEFAULT 0,
    consecutive_hits INTEGER DEFAULT 0,
    current_momentum TEXT DEFAULT 'neutral',

    -- Adaptive thresholds
    hot_threshold FLOAT DEFAULT 75,
    viral_threshold FLOAT DEFAULT 90,
    flop_threshold FLOAT DEFAULT 25,

    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for account_intelligence
CREATE INDEX IF NOT EXISTS idx_acct_intel_user_id ON public.account_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_acct_intel_platform ON public.account_intelligence(platform);

-- RLS for account_intelligence
ALTER TABLE public.account_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intelligence"
    ON public.account_intelligence FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intelligence"
    ON public.account_intelligence FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intelligence"
    ON public.account_intelligence FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own intelligence"
    ON public.account_intelligence FOR DELETE
    USING (auth.uid() = user_id);
