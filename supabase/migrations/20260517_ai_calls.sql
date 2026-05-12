-- Migration 11: AI calls — extend existing table with admin columns
-- The ai_calls table already exists (20260503_ai_calls.sql) with 10 rows.
-- We ADD missing columns for the admin hub instead of recreating.

ALTER TABLE public.ai_calls ADD COLUMN IF NOT EXISTS cached_tokens INTEGER DEFAULT 0;
ALTER TABLE public.ai_calls ADD COLUMN IF NOT EXISTS context_id UUID;
ALTER TABLE public.ai_calls ADD COLUMN IF NOT EXISTS context_type TEXT;

-- Add indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_ai_calls_context
  ON ai_calls(context_type, context_id) WHERE context_id IS NOT NULL;
