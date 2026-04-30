-- Fix: monthly quota never reset because external cron was not configured.
-- Solution: make increment_video_usage self-resetting using a usage_reset_month column.

-- 1. Add usage_reset_month column (YYYYMM integer)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS usage_reset_month INTEGER DEFAULT 0;

-- 2. Initialize existing rows to current month
UPDATE public.profiles
SET usage_reset_month = EXTRACT(YEAR FROM NOW())::INTEGER * 100 + EXTRACT(MONTH FROM NOW())::INTEGER
WHERE usage_reset_month = 0 OR usage_reset_month IS NULL;

-- 3. Self-resetting increment_video_usage
CREATE OR REPLACE FUNCTION public.increment_video_usage(
    p_user_id UUID,
    p_max_videos INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_month INTEGER;
    v_updated INTEGER;
BEGIN
    v_current_month := EXTRACT(YEAR FROM NOW())::INTEGER * 100 + EXTRACT(MONTH FROM NOW())::INTEGER;

    -- Auto-reset if month changed
    UPDATE public.profiles
    SET
        monthly_videos_used = 0,
        monthly_processing_minutes_used = 0,
        usage_reset_month = v_current_month,
        updated_at = NOW()
    WHERE id = p_user_id
      AND (usage_reset_month IS NULL OR usage_reset_month < v_current_month);

    -- Atomic increment if under limit
    UPDATE public.profiles
    SET
        monthly_videos_used = monthly_videos_used + 1,
        updated_at = NOW()
    WHERE id = p_user_id
      AND (p_max_videos = -1 OR monthly_videos_used < p_max_videos);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
        RETURN TRUE;
    END IF;

    -- Fallback: consume from bonus balance
    UPDATE public.profiles
    SET
        bonus_videos = bonus_videos - 1,
        updated_at = NOW()
    WHERE id = p_user_id
      AND bonus_videos > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;
