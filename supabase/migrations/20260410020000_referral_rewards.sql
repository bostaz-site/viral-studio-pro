-- Referral rewards: lifetime bonus_videos balance that's consumed AFTER
-- the monthly plan quota is exhausted. This way a parrain actif doesn't
-- re-gift themselves the bonus every month, but they DO keep extra
-- headroom when they hit their normal cap.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bonus_videos INTEGER NOT NULL DEFAULT 0;

-- Extend increment_video_usage to fall through to bonus_videos when the
-- monthly plan quota is exhausted. Still returns true/false, so callers
-- don't need to change their control flow.
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
    -- First try: consume from the monthly plan quota
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

    -- Fallback: consume from the lifetime bonus balance
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

-- Extend handle_new_user to grant both sides a bonus when the signup
-- came through a referral code.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inviter_id UUID;
    new_code TEXT;
    attempts INT := 0;
    ref_code_input TEXT;
    new_user_bonus INT := 0;
BEGIN
    ref_code_input := NEW.raw_user_meta_data->>'referred_by_code';
    IF ref_code_input IS NOT NULL AND LENGTH(ref_code_input) > 0 THEN
        SELECT id INTO inviter_id
        FROM public.profiles
        WHERE referral_code = UPPER(TRIM(ref_code_input))
        LIMIT 1;

        IF inviter_id IS NOT NULL THEN
            -- New user gets +2 bonus videos just for accepting the invite
            new_user_bonus := 2;
        END IF;
    END IF;

    -- Generate a unique referral code for this new user
    LOOP
        new_code := public.generate_referral_code();
        BEGIN
            INSERT INTO public.profiles (
                id, email, full_name, avatar_url,
                referral_code, referred_by, bonus_videos
            )
            VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
                COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
                new_code,
                inviter_id,
                new_user_bonus
            );
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            attempts := attempts + 1;
            IF attempts > 10 THEN RAISE; END IF;
        END;
    END LOOP;

    -- Reward the inviter with +5 bonus videos
    IF inviter_id IS NOT NULL THEN
        UPDATE public.profiles
        SET bonus_videos = bonus_videos + 5, updated_at = NOW()
        WHERE id = inviter_id;
    END IF;

    RETURN NEW;
END;
$$;
