-- Influencers CRM table + Import Batches
-- Core table for the admin CRM pipeline

-- ============================================================
-- influencers — The main CRM table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,

  -- Platform info
  primary_platform TEXT CHECK (primary_platform IN (
    'twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other'
  )),
  platform_handle TEXT,
  platform_url TEXT,
  audience_size INTEGER,
  niche TEXT,
  language TEXT DEFAULT 'en',
  country TEXT,
  timezone TEXT,

  -- Pipeline status
  status TEXT NOT NULL DEFAULT 'cold' CHECK (status IN (
    'unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied',
    'interested', 'demo_sent', 'evaluating', 'onboarded', 'active',
    'paying', 'dormant', 'declined', 'blocked'
  )),
  status_changed_at TIMESTAMPTZ DEFAULT now(),

  -- Lead scoring
  lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lead_score_reasons JSONB DEFAULT '[]'::jsonb,
  estimated_value_usd NUMERIC(10, 2),

  -- Affiliate
  affiliate_code TEXT UNIQUE,
  stripe_connect_account_id TEXT,
  stripe_connect_status TEXT CHECK (stripe_connect_status IN (
    'not_created', 'pending_kyc', 'active', 'restricted', 'rejected'
  )),

  -- Aggregated metrics
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_emails_replied INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  total_paying_referrals INTEGER DEFAULT 0,
  total_commission_earned_cents BIGINT DEFAULT 0,
  total_commission_paid_cents BIGINT DEFAULT 0,
  last_active_at TIMESTAMPTZ,

  -- Discovery
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  source TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Compliance
  unsubscribed BOOLEAN DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  gdpr_consent BOOLEAN DEFAULT FALSE,
  data_retention_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status);
CREATE INDEX IF NOT EXISTS idx_influencers_email ON influencers(email);
CREATE INDEX IF NOT EXISTS idx_influencers_affiliate_code ON influencers(affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_lead_score ON influencers(lead_score DESC) WHERE status NOT IN ('declined', 'blocked');
CREATE INDEX IF NOT EXISTS idx_influencers_niche ON influencers(niche);
CREATE INDEX IF NOT EXISTS idx_influencers_platform ON influencers(primary_platform);
CREATE INDEX IF NOT EXISTS idx_influencers_tags ON influencers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_influencers_last_active ON influencers(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencers_source ON influencers(source);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_influencers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION update_influencers_updated_at();

-- RLS: admin only via service role
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- import_batches — Tracking CSV imports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  source TEXT NOT NULL,
  file_name TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_skipped_suppression INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'processing' CHECK (status IN (
    'processing', 'completed', 'failed', 'partial'
  )),
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_time
  ON import_batches(imported_by, started_at DESC);

-- RLS: admin only via service role
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
