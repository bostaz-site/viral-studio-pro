-- Referral program: every profile gets a short unique code, and if a new
-- signup came through ?ref=CODE we record the inviter in profiles.referred_by.
--
-- The code is 8 chars base32 (no confusing 0/O/1/I), generated inside the
-- handle_new_user trigger with a small retry loop in case of collision.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_idx
    ON public.profiles (referral_code)
    WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx
    ON public.profiles (referred_by)
    WHERE referred_by IS NOT NULL;

-- Backfill codes for existing users
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code TEXT;
    i INT;
BEGIN
    code := '';
    FOR i IN 1..8 LOOP
        code := code || SUBSTR(alphabet, (FLOOR(RANDOM() * LENGTH(alphabet)) + 1)::INT, 1);
    END LOOP;
    RETURN code;
END;
$$;

DO $$
DECLARE
    r RECORD;
    new_code TEXT;
    attempts INT;
BEGIN
    FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
        attempts := 0;
        LOOP
            new_code := public.generate_referral_code();
            BEGIN
                UPDATE public.profiles SET referral_code = new_code WHERE id = r.id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                attempts := attempts + 1;
                IF attempts > 10 THEN RAISE; END IF;
            END;
        END LOOP;
    END LOOP;
END
$$;

-- Update handle_new_user trigger to (a) generate a referral code and
-- (b) resolve raw_user_meta_data->>'referred_by_code' to profiles.id
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
BEGIN
    ref_code_input := NEW.raw_user_meta_data->>'referred_by_code';
    IF ref_code_input IS NOT NULL AND LENGTH(ref_code_input) > 0 THEN
        SELECT id INTO inviter_id
        FROM public.profiles
        WHERE referral_code = UPPER(TRIM(ref_code_input))
        LIMIT 1;
    END IF;

    -- Generate a unique referral code for this new user
    LOOP
        new_code := public.generate_referral_code();
        BEGIN
            INSERT INTO public.profiles (id, email, full_name, avatar_url, referral_code, referred_by)
            VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
                COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
                new_code,
                inviter_id
            );
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            attempts := attempts + 1;
            IF attempts > 10 THEN RAISE; END IF;
        END;
    END LOOP;

    RETURN NEW;
END;
$$;
