-- Lightweight privacy-first event tracking for conversion funnel visibility.
-- No PII: we store a hashed session_id (client-generated UUID per tab),
-- the event name, the page path, and optional JSONB metadata.

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    page_path TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Hot-path queries: funnel by event name + time window
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
    ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
    ON public.analytics_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
    ON public.analytics_events (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

-- RLS: lock down reads, allow service_role to insert/read.
-- Anonymous inserts happen via the API route using the service-role key,
-- so RLS stays deny-by-default for everyone else.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Only service role can read (used by the internal analytics dashboard later)
DROP POLICY IF EXISTS "analytics_events_service_read" ON public.analytics_events;
CREATE POLICY "analytics_events_service_read"
    ON public.analytics_events
    FOR SELECT
    TO service_role
    USING (true);

-- Inserts only via service role (API route) — no direct anon inserts
DROP POLICY IF EXISTS "analytics_events_service_insert" ON public.analytics_events;
CREATE POLICY "analytics_events_service_insert"
    ON public.analytics_events
    FOR INSERT
    TO service_role
    WITH CHECK (true);

COMMENT ON TABLE public.analytics_events IS
    'Privacy-first funnel tracking. No IP, no UA string — just session_id + event_name + metadata.';
