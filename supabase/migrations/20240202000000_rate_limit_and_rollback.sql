-- Rate limit log table for persistent cross-instance rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_created
    ON public.rate_limit_log(identifier, created_at DESC);

-- Auto-cleanup: delete entries older than 10 minutes
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.rate_limit_log
    WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

-- Check rate limit: returns TRUE if allowed, FALSE if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_limit INTEGER,
    p_window_ms INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_window INTERVAL;
    v_count INTEGER;
BEGIN
    v_window := (p_window_ms || ' milliseconds')::INTERVAL;

    SELECT COUNT(*) INTO v_count
    FROM public.rate_limit_log
    WHERE identifier = p_identifier
      AND created_at > NOW() - v_window;

    IF v_count >= p_limit THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.rate_limit_log (identifier, created_at)
    VALUES (p_identifier, NOW());

    RETURN TRUE;
END;
$$;

-- Decrement video usage (for rollback on failure)
CREATE OR REPLACE FUNCTION public.decrement_video_usage(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.profiles
    SET monthly_videos_used = GREATEST(monthly_videos_used - 1, 0),
        updated_at = NOW()
    WHERE id = p_user_id
      AND monthly_videos_used > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;
