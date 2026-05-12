-- Migration 5: Campaign recipients — links influencer to campaign + sequence step
-- Without this, impossible to know who is at which step of which sequence

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  sequence_step INTEGER DEFAULT 0,
  mailbox_id UUID REFERENCES mailboxes(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'scheduled', 'sent', 'opened', 'clicked',
    'replied', 'bounced', 'unsubscribed', 'failed', 'skipped'
  )),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE (campaign_id, influencer_id, sequence_step)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON campaign_recipients(campaign_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_influencer
  ON campaign_recipients(influencer_id, sent_at DESC);

DO $$ BEGIN
  CREATE TRIGGER tr_campaign_recipients_updated_at BEFORE UPDATE ON campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
