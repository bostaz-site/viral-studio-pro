-- Browse Clips V2: Kick integration, advanced scoring, favorites, admin streamers

-- 1. Add columns to streamers
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avg_clip_views FLOAT DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avg_clip_velocity FLOAT DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS total_clips_tracked INTEGER DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS kick_login TEXT;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS fetch_interval_minutes INTEGER DEFAULT 15;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'irl';

-- 2. Add scoring columns to trending_clips
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS early_signal_score FLOAT;
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS anomaly_score FLOAT;
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS feed_category TEXT DEFAULT 'normal';

-- 3. Table saved_clips
CREATE TABLE IF NOT EXISTS public.saved_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id UUID REFERENCES public.trending_clips(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, clip_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_saved_clips_user_id ON public.saved_clips(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_clips_clip_id ON public.saved_clips(clip_id);
CREATE INDEX IF NOT EXISTS idx_trending_feed_category ON public.trending_clips(feed_category);
CREATE INDEX IF NOT EXISTS idx_trending_early_signal ON public.trending_clips(early_signal_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_streamers_kick_login ON public.streamers(kick_login);

-- 5. RLS saved_clips
ALTER TABLE public.saved_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own saved clips"
    ON public.saved_clips FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Insert new Twitch streamers
INSERT INTO public.streamers (display_name, twitch_login, niche, priority, active, fetch_interval_minutes) VALUES
    ('StableRonaldo', 'stableronaldo', 'irl', 5, true, 15),
    ('PlaqueBoyMax', 'plaqueboymax', 'irl', 5, true, 15),
    ('Duke Dennis', 'dukedennis', 'irl', 5, true, 15),
    ('Fanum', 'fanum', 'irl', 5, true, 15),
    ('Lacy', 'lacyfn', 'irl', 5, true, 15),
    ('YourRAGE', 'yourragegaming', 'irl', 5, true, 15),
    ('TheFouFou', 'thefoufou', 'irl', 5, true, 15),
    ('iamtherealak', 'iamtherealak', 'irl', 5, true, 15),
    ('ZackTTG', 'zackttg', 'irl', 5, true, 15),
    ('JasonTheWeen', 'jasontheween', 'irl', 5, true, 15),
    ('CaseOh', 'caseoh_', 'irl', 5, true, 15),
    ('DD Osama', 'dd_osama', 'irl', 5, true, 15),
    ('Agent00', 'agent00', 'irl', 5, true, 15),
    ('BruceDropEmOff', 'brucedropemoff', 'irl', 5, true, 15)
ON CONFLICT (twitch_login) DO NOTHING;

-- 7. Update existing top streamers with high priority and fast fetch
UPDATE public.streamers SET priority = 10, fetch_interval_minutes = 8
WHERE twitch_login IN ('kaicenat', 'ishowspeed', 'xqc', 'adinross', 'jynxzi', 'sketch');

-- 8. Insert Kick streamers (no unique constraint on kick_login, use display_name to avoid dupes)
INSERT INTO public.streamers (display_name, kick_login, niche, priority, active, fetch_interval_minutes) VALUES
    ('N3on', 'neon', 'irl', 8, true, 10),
    ('Clavicular', 'clavicular', 'irl', 5, true, 15),
    ('Adin Ross Kick', 'adin', 'irl', 8, true, 10),
    ('Braden', 'braden', 'irl', 5, true, 15),
    ('Sam Frank', 'samf', 'irl', 5, true, 15),
    ('Fousey', 'fousey', 'irl', 5, true, 15),
    ('Sneako', 'sneako', 'irl', 5, true, 15),
    ('Johnny Somali', 'johnnysomali', 'irl', 5, true, 15),
    ('SuspendedCEO', 'suspendedceo', 'irl', 5, true, 15),
    ('Vitaly', 'vitaly', 'irl', 5, true, 15)
ON CONFLICT DO NOTHING;
