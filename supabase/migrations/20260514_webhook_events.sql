-- Migration 4: Webhook events — idempotency layer
-- Prevents double-counting opens/replies/commissions if a provider resends

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN (
    'instantly', 'stripe', 'resend', 'smartlead', 'maildoso', 'manual'
  )),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'duplicate'
  )),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(processing_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type ON webhook_events(provider, event_type, received_at DESC);
