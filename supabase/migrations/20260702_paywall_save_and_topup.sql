-- Paywall: one-time save flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paywall_save_used BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.paywall_save_used IS 'True after the user has used their one-time free save at first paywall (lifetime, never resets)';
