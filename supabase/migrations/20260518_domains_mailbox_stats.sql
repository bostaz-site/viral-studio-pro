-- Migration 13: Domains + mailbox daily stats — cold email infrastructure tracking

-- domains — cold email domain tracking
CREATE TABLE IF NOT EXISTS public.domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  registrar TEXT,
  purchased_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cost_yearly_usd NUMERIC(8, 2),
  redirect_to TEXT,
  spf_configured BOOLEAN DEFAULT FALSE,
  dkim_configured BOOLEAN DEFAULT FALSE,
  dmarc_configured BOOLEAN DEFAULT FALSE,
  warmup_started_at TIMESTAMPTZ,
  status TEXT DEFAULT 'warming' CHECK (status IN (
    'warming', 'active', 'paused', 'blacklisted', 'retired'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);

-- mailbox_daily_stats — health monitoring per mailbox per day
CREATE TABLE IF NOT EXISTS public.mailbox_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_complained INTEGER DEFAULT 0,
  emails_unsubscribed INTEGER DEFAULT 0,
  warmup_emails INTEGER DEFAULT 0,
  reputation_score NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE (mailbox_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_mailbox_stats_date
  ON mailbox_daily_stats(mailbox_id, stat_date DESC);
