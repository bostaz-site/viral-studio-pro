-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================

-- Videos: most queries filter by user_id + status
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_user_status ON public.videos(user_id, status);

-- Clips: queried by video_id and user_id frequently
CREATE INDEX IF NOT EXISTS idx_clips_video_id ON public.clips(video_id);
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON public.clips(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_user_status ON public.clips(user_id, status);

-- Viral scores: always joined via clip_id
CREATE INDEX IF NOT EXISTS idx_viral_scores_clip_id ON public.viral_scores(clip_id);

-- Transcriptions: looked up by video_id
CREATE INDEX IF NOT EXISTS idx_transcriptions_video_id ON public.transcriptions(video_id);

-- Trending clips: sorted by velocity_score, filtered by niche/platform
CREATE INDEX IF NOT EXISTS idx_trending_velocity ON public.trending_clips(velocity_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_trending_platform ON public.trending_clips(platform);
CREATE INDEX IF NOT EXISTS idx_trending_niche ON public.trending_clips(niche);
CREATE INDEX IF NOT EXISTS idx_trending_scraped ON public.trending_clips(scraped_at DESC NULLS LAST);

-- Publications: queried by clip_id and status
CREATE INDEX IF NOT EXISTS idx_publications_clip_id ON public.publications(clip_id);
CREATE INDEX IF NOT EXISTS idx_publications_status ON public.publications(status);
CREATE INDEX IF NOT EXISTS idx_publications_scheduled ON public.publications(scheduled_at) WHERE status = 'scheduled';

-- Brand templates: queried by user_id
CREATE INDEX IF NOT EXISTS idx_brand_templates_user_id ON public.brand_templates(user_id);

-- Social accounts: queried by user_id
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON public.social_accounts(user_id);

-- ==========================================
-- STRIPE WEBHOOK IDEMPOTENCY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup events older than 7 days (optional, can be run via cron)
-- DELETE FROM public.stripe_events WHERE processed_at < NOW() - INTERVAL '7 days';

-- ==========================================
-- ATOMIC QUOTA INCREMENT FUNCTION
-- ==========================================

-- Atomically increment usage and check limit in one operation.
-- Returns TRUE if the increment was allowed, FALSE if limit reached.
CREATE OR REPLACE FUNCTION public.increment_video_usage(
    p_user_id UUID,
    p_max_videos INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    -- Atomic: only increment if under the limit (or unlimited = -1)
    UPDATE public.profiles
    SET
        monthly_videos_used = monthly_videos_used + 1,
        updated_at = NOW()
    WHERE id = p_user_id
      AND (p_max_videos = -1 OR monthly_videos_used < p_max_videos);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;
