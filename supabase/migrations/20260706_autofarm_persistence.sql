-- Autofarm persistence: add auto_distribute_enabled to distribution_settings
-- This column tracks whether the user has auto-distribute toggled ON.
-- The UI reads/writes this flag so state survives page reloads and matches what the cron sees.

ALTER TABLE public.distribution_settings
  ADD COLUMN IF NOT EXISTS auto_distribute_enabled BOOLEAN DEFAULT FALSE;
