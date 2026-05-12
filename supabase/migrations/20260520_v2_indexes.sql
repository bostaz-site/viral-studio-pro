-- Migration 18: v2.0 critical indexes for pipeline ops and analytics

-- Pipeline ops (frequently filtered/sorted)
CREATE INDEX IF NOT EXISTS idx_influencers_status_score
  ON influencers(status, lead_score DESC);

CREATE INDEX IF NOT EXISTS idx_influencers_status_changed
  ON influencers(status, status_changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_influencers_source_created
  ON influencers(source, created_at DESC);

-- Email messages (high-volume table)
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_sent
  ON email_messages(mailbox_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_influencer_created
  ON email_messages(influencer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_unique
  ON email_messages(message_id_external)
  WHERE message_id_external IS NOT NULL;

-- Funnel events (will get huge)
CREATE INDEX IF NOT EXISTS idx_funnel_events_campaign_type_time
  ON funnel_events(campaign_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_events_message
  ON funnel_events(message_id) WHERE message_id IS NOT NULL;

-- Affiliate analytics
CREATE INDEX IF NOT EXISTS idx_referrals_influencer_status_paid
  ON affiliate_referrals(influencer_id, status, first_paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_created
  ON affiliate_referrals(created_at DESC);

-- Payouts ops
CREATE INDEX IF NOT EXISTS idx_payouts_status_period
  ON affiliate_payouts(status, period_start_at DESC);
