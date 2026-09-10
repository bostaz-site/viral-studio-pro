ALTER TABLE public.distribution_settings ADD COLUMN IF NOT EXISTS cadence_preset TEXT DEFAULT 'growth' CHECK (cadence_preset IN ('warmup', 'growth', 'farm'));
COMMENT ON COLUMN public.distribution_settings.cadence_preset IS 'Posting cadence: warmup (new account <7d), growth (<30 posts), farm (30+ posts)';
