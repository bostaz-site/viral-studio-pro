-- Distribution Hub: scheduled_publications + distribution_settings tables

-- Table for scheduled publications (queue)
CREATE TABLE IF NOT EXISTS public.scheduled_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT[],
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
    publish_result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for distribution settings per user
CREATE TABLE IF NOT EXISTS public.distribution_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    max_posts_per_day INTEGER DEFAULT 3,
    min_hours_between_posts FLOAT DEFAULT 3,
    default_hashtags JSONB DEFAULT '[]',
    caption_template TEXT,
    niche TEXT,
    optimal_hours JSONB DEFAULT '{}',
    ai_optimized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_user_id ON public.scheduled_publications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_status ON public.scheduled_publications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_scheduled_at ON public.scheduled_publications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_distribution_settings_user_id ON public.distribution_settings(user_id);

-- RLS
ALTER TABLE public.scheduled_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scheduled publications"
    ON public.scheduled_publications
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own distribution settings"
    ON public.distribution_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
