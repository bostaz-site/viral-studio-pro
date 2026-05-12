-- Migration 6: Email events — granular event tracking per message
-- Separate from email_messages because one message can have N events

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES campaign_recipients(id) ON DELETE SET NULL,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent', 'delivered', 'opened', 'clicked', 'replied',
    'bounced_hard', 'bounced_soft', 'unsubscribed', 'spam_complaint'
  )),
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  webhook_event_id UUID REFERENCES webhook_events(id)
);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign_type_time
  ON email_events(campaign_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_influencer_time
  ON email_events(influencer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_message
  ON email_events(message_id) WHERE message_id IS NOT NULL;
