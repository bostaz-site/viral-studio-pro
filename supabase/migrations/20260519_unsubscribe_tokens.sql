-- Migration 15: Unsubscribe tokens — signed URL tokens (no email in URL)
-- URL format: /unsubscribe?t=<token>
-- App looks up token_hash, gets email, adds to suppression_list

-- Drop old version if it exists (was created with TEXT email in old migration)
DROP TABLE IF EXISTS public.unsubscribe_tokens CASCADE;

CREATE TABLE public.unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  email CITEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  source_campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL
);

CREATE INDEX idx_unsubscribe_tokens_email
  ON unsubscribe_tokens(email) WHERE used_at IS NULL;
