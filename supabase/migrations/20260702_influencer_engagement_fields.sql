-- Denormalized engagement booleans + timestamps on influencers
-- Powers the Lead Management cockpit predefined views

-- ============================================================
-- New columns
-- ============================================================
ALTER TABLE public.influencers
ADD COLUMN IF NOT EXISTS has_opened BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_clicked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_replied BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_bounced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_unsubscribed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_replied_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reply_reviewed BOOLEAN DEFAULT FALSE;

-- ============================================================
-- Indexes for cockpit predefined views
-- ============================================================

-- "Replied - a traiter" view: status=replied, reply_reviewed=false
CREATE INDEX IF NOT EXISTS idx_influencers_replied_unreviewed
  ON influencers(last_replied_at DESC)
  WHERE status = 'replied' AND reply_reviewed = FALSE;

-- "Interested - follow-up du" view
CREATE INDEX IF NOT EXISTS idx_influencers_followup_due
  ON influencers(next_follow_up_at ASC NULLS FIRST)
  WHERE status = 'interested';

-- "Contacted sans reponse" view
CREATE INDEX IF NOT EXISTS idx_influencers_contacted_no_reply
  ON influencers(last_sent_at ASC)
  WHERE status = 'contacted' AND has_replied = FALSE;

-- General status + last_replied_at composite
CREATE INDEX IF NOT EXISTS idx_influencers_status_replied
  ON influencers(status, last_replied_at DESC);

-- General status + next_follow_up_at composite
CREATE INDEX IF NOT EXISTS idx_influencers_status_followup
  ON influencers(status, next_follow_up_at ASC NULLS FIRST);

-- RLS: same as existing influencers (admin via service role, no anon access)
-- No new policies needed — existing RLS on influencers already covers these columns
