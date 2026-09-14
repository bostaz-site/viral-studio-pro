ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS step_number INTEGER DEFAULT NULL;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT 0;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS sequence_id TEXT DEFAULT NULL;
-- Template data inserted via MCP (4 rows: cold-v1-step1/2/3 + cold-v1-welcome)
