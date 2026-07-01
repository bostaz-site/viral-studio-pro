-- Add has_completed_first_clip to profiles for onboarding gate
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_first_clip BOOLEAN NOT NULL DEFAULT FALSE;

-- Kill switch: backfill all existing users as completed so they never see the
-- first-clip onboarding overlay. Only users who sign up AFTER this migration
-- will have DEFAULT FALSE and go through the onboarding flow.
UPDATE public.profiles
  SET has_completed_first_clip = TRUE
  WHERE has_completed_first_clip = FALSE;

COMMENT ON COLUMN public.profiles.has_completed_first_clip IS
  'Set to true when the user watches their first rendered clip result. Gates the onboarding overlay.';
