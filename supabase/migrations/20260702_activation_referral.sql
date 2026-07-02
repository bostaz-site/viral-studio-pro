-- Activation-based referral: reward on first render, not signup
-- Anti-abuse: track referral_rewarded_at, monthly cap, fingerprint check

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

-- Track monthly referral reward count per inviter (cap at 5/month)
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL DEFAULT 'first_render',
  inviter_bonus INTEGER NOT NULL DEFAULT 3,
  invitee_bonus INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(invitee_id, reward_type) -- one reward per invitee per type
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_inviter_month
  ON referral_rewards(inviter_id, created_at DESC);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Update handle_new_user: no longer grant bonus at signup
-- The bonus now happens in the app layer on first render completion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_code TEXT;
    attempts INT := 0;
    ref_code_input TEXT;
    inviter_id UUID;
BEGIN
    ref_code_input := NEW.raw_user_meta_data->>'referred_by_code';

    -- Resolve inviter but do NOT grant bonus yet (deferred to first render)
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
            INSERT INTO public.profiles (
                id, email, full_name, avatar_url,
                referral_code, referred_by, bonus_videos, acquisition_source
            )
            VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
                COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
                new_code,
                inviter_id,
                0, -- no bonus at signup; granted on first render
                NULLIF(NEW.raw_user_meta_data->>'acquisition_source', '')
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
