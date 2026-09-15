-- cold-email-v2: add columns for 5-step sequence, reply buckets, metrics, warmup tracking

-- email_templates: spintax + word limit
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS spintax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_words INTEGER NOT NULL DEFAULT 80;

-- influencers: reply bucket + re-sequence date
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS reply_bucket TEXT DEFAULT NULL
    CHECK (reply_bucket IN ('interested', 'evaluating', 'not_now', 'wrong_person', 'unsubscribed', 'negative')),
  ADD COLUMN IF NOT EXISTS resequence_after DATE DEFAULT NULL;

-- email_campaigns: positive-reply metric
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS total_positive_replies INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positive_reply_rate_pct NUMERIC DEFAULT NULL;

-- mailboxes: warmup tracking
ALTER TABLE public.mailboxes
  ADD COLUMN IF NOT EXISTS warmup_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warmup_paused_at TIMESTAMPTZ DEFAULT NULL;
