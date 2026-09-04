ALTER TABLE public.distribution_settings ADD COLUMN IF NOT EXISTS autofarm_paused_until TIMESTAMPTZ DEFAULT NULL;
COMMENT ON COLUMN public.distribution_settings.autofarm_paused_until IS 'If set and NOW() < this value, autofarm is paused (warmup/flag cooldown)';
