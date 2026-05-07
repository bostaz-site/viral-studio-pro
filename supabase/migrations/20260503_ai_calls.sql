-- AI cost tracking: logs every AI API call with tokens, cost, latency.
-- Admin-only access (service_role bypasses RLS).

CREATE TABLE IF NOT EXISTS public.ai_calls (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- null for system/cron calls
    model TEXT NOT NULL,
    feature TEXT NOT NULL, -- canonical: 'mood_detection', 'hook_generation', 'caption_engine', 'vision', etc.
    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_usd NUMERIC(10, 6), -- computed by call-logger from pricing table
    latency_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error TEXT,
    metadata JSONB, -- ex: { "clipId": "xxx", "prompt_version": "v1" }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: only service_role can read (admin-only data)
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — service_role key bypasses RLS for inserts and reads.
-- Admin dashboard queries use the admin client (service_role).

-- Indexes for analytics queries
CREATE INDEX idx_ai_calls_created
    ON public.ai_calls (created_at DESC);

CREATE INDEX idx_ai_calls_user_created
    ON public.ai_calls (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX idx_ai_calls_feature
    ON public.ai_calls (feature, created_at DESC);

CREATE INDEX idx_ai_calls_model
    ON public.ai_calls (model, created_at DESC);
