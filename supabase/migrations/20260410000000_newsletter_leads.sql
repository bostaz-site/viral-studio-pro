-- Newsletter lead capture from landing page
-- Kept intentionally simple: no PII beyond email, no auth requirement,
-- service_role inserts only (anon role can't read/write).

CREATE TABLE IF NOT EXISTS public.newsletter_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    source TEXT DEFAULT 'landing_footer',
    user_agent TEXT,
    referrer TEXT,
    ip_hash TEXT,
    confirmed BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_leads_email_lower_idx
    ON public.newsletter_leads (LOWER(email));

CREATE INDEX IF NOT EXISTS newsletter_leads_created_at_idx
    ON public.newsletter_leads (created_at DESC);

ALTER TABLE public.newsletter_leads ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles.
-- Only service_role (used by the API route) can insert/read.
