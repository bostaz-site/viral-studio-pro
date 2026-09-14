ALTER TABLE public.distribution_settings ADD COLUMN IF NOT EXISTS auto_onboard_mode TEXT DEFAULT 'review' CHECK (auto_onboard_mode IN ('review', 'auto'));
COMMENT ON COLUMN public.distribution_settings.auto_onboard_mode IS 'Auto-onboarding mode: review = draft for approval, auto = send immediately';
