-- Add has_completed_first_clip to profiles
-- Gates the "Make Your First Viral Clip" onboarding overlay.
-- Set to true once the user sees their first render result.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_completed_first_clip BOOLEAN DEFAULT false;
