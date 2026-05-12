-- Migration 1: Admin Foundation — Core admin tables + admin_users with roles
-- Creates all prerequisite v1 admin tables + admin_users for the admin hub

-- ============================================
-- V1 CORE TABLES (prerequisites for v2.0)
-- ============================================

-- influencers — CRM core table
CREATE TABLE IF NOT EXISTS public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
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
  status TEXT NOT NULL DEFAULT 'cold' CHECK (status IN (
    'unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied',
    'interested', 'demo_sent', 'evaluating', 'onboarded', 'active',
    'paying', 'dormant', 'declined', 'blocked'
  )),
  status_changed_at TIMESTAMPTZ DEFAULT now(),
  lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lead_score_reasons JSONB DEFAULT '[]'::jsonb,
  estimated_value_usd NUMERIC(10, 2),
  affiliate_code TEXT UNIQUE,
  stripe_connect_account_id TEXT,
  stripe_connect_status TEXT CHECK (stripe_connect_status IN (
    'not_created', 'pending_kyc', 'active', 'restricted', 'rejected'
  )),
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_emails_replied INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  total_paying_referrals INTEGER DEFAULT 0,
  total_commission_earned_cents BIGINT DEFAULT 0,
  total_commission_paid_cents BIGINT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
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

-- email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  variables JSONB,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES email_templates(id),
  times_used INTEGER DEFAULT 0,
  avg_open_rate NUMERIC(5, 2),
  avg_reply_rate NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- email_sequences
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- mailboxes
CREATE TABLE IF NOT EXISTS public.mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  domain TEXT NOT NULL,
  provider TEXT CHECK (provider IN (
    'zoho', 'maildoso', 'gmail', 'outlook365', 'other'
  )),
  imap_host TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  credentials_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'warming' CHECK (status IN (
    'warming', 'active', 'paused', 'blocked', 'rate_limited', 'retired'
  )),
  last_health_check_at TIMESTAMPTZ,
  reputation_score INTEGER DEFAULT 70 CHECK (reputation_score BETWEEN 0 AND 100),
  daily_send_limit INTEGER DEFAULT 30,
  emails_sent_today INTEGER DEFAULT 0,
  total_emails_sent INTEGER DEFAULT 0,
  bounce_rate_pct NUMERIC(5, 2) DEFAULT 0,
  complaint_rate_pct NUMERIC(5, 2) DEFAULT 0,
  spf_valid BOOLEAN,
  dkim_valid BOOLEAN,
  dmarc_valid BOOLEAN,
  last_dns_check_at TIMESTAMPTZ,
  instantly_account_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  retired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_status ON mailboxes(status);
CREATE INDEX IF NOT EXISTS idx_mailboxes_domain ON mailboxes(domain);

-- email_campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'archived'
  )),
  target_segment JSONB,
  scheduled_start_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sequence_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  ab_variants JSONB,
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,
  instantly_campaign_id TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON email_campaigns(scheduled_start_at) WHERE status = 'scheduled';

-- email_messages
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE SET NULL,
  in_reply_to_message_id UUID REFERENCES email_messages(id),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id_external TEXT,
  thread_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  bounce_type TEXT,
  bounce_reason TEXT,
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'spam', 'hostile')),
  ai_intent TEXT,
  ai_classified_at TIMESTAMPTZ,
  ai_confidence NUMERIC(3, 2),
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  human_response_drafted TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_influencer ON email_messages(influencer_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON email_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction_unread ON email_messages(direction, is_read) WHERE direction = 'inbound' AND is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON email_messages(ai_sentiment) WHERE ai_sentiment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_recent ON email_messages(created_at DESC);

-- demo_packages
CREATE TABLE IF NOT EXISTS public.demo_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'fetching_clips', 'rendering', 'ready', 'failed', 'expired'
  )),
  source_clips JSONB,
  selected_clip_ids UUID[],
  landing_page_slug TEXT UNIQUE,
  landing_page_visits INTEGER DEFAULT 0,
  landing_page_first_visit_at TIMESTAMPTZ,
  avg_viral_score NUMERIC(5, 2),
  total_render_cost_cents INTEGER,
  generated_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demos_influencer ON demo_packages(influencer_id);
CREATE INDEX IF NOT EXISTS idx_demos_status ON demo_packages(status);
CREATE INDEX IF NOT EXISTS idx_demos_slug ON demo_packages(landing_page_slug);

-- affiliate_referrals
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attribution_type TEXT NOT NULL CHECK (attribution_type IN (
    'cookie', 'fingerprint', 'manual_assigned', 'magic_link'
  )),
  attribution_metadata JSONB,
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'attributed' CHECK (status IN (
    'attributed', 'paying', 'churned', 'refunded', 'disputed'
  )),
  total_revenue_cents BIGINT DEFAULT 0,
  total_commission_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_referral_per_user ON affiliate_referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_influencer ON affiliate_referrals(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON affiliate_referrals(status);

-- Drop old affiliate_payouts (0 rows, incompatible schema from old affiliate system)
DROP TABLE IF EXISTS public.affiliate_payouts;

-- affiliate_payouts — new admin schema
CREATE TABLE public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  period_start_at TIMESTAMPTZ NOT NULL,
  period_end_at TIMESTAMPTZ NOT NULL,
  gross_commission_cents BIGINT NOT NULL,
  adjustments_cents BIGINT DEFAULT 0,
  net_payout_cents BIGINT NOT NULL,
  included_referral_ids UUID[],
  referrals_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'on_hold', 'sending', 'sent', 'failed', 'reversed'
  )),
  stripe_transfer_id TEXT UNIQUE,
  stripe_transfer_status TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payouts_influencer ON affiliate_payouts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_period ON affiliate_payouts(period_start_at, period_end_at);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON affiliate_payouts(status);

-- funnel_events
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_metadata JSONB,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source TEXT,
  source_metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_events_influencer_time ON funnel_events(influencer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON funnel_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_recent ON funnel_events(occurred_at DESC);

-- admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_recent ON admin_audit_log(created_at DESC);

-- ============================================
-- ADMIN_USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'ops', 'va', 'finance', 'readonly')),
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER tr_influencers_updated_at BEFORE UPDATE ON influencers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_email_sequences_updated_at BEFORE UPDATE ON email_sequences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_mailboxes_updated_at BEFORE UPDATE ON mailboxes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_email_messages_updated_at BEFORE UPDATE ON email_messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_affiliate_referrals_updated_at BEFORE UPDATE ON affiliate_referrals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER tr_affiliate_payouts_updated_at BEFORE UPDATE ON affiliate_payouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-log influencer status changes to funnel_events
CREATE OR REPLACE FUNCTION log_influencer_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO funnel_events(influencer_id, event_type, event_metadata, occurred_at)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'lead_score', NEW.lead_score),
      now()
    );
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER tr_influencer_status_change BEFORE UPDATE ON influencers
    FOR EACH ROW EXECUTE FUNCTION log_influencer_status_change();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Aggregate email metrics on email_messages changes
CREATE OR REPLACE FUNCTION update_influencer_email_metrics()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.direction = 'outbound' AND NEW.sent_at IS NOT NULL THEN
      UPDATE influencers
      SET total_emails_sent = total_emails_sent + 1,
          last_active_at = COALESCE(GREATEST(last_active_at, NEW.sent_at), NEW.sent_at)
      WHERE id = NEW.influencer_id;
    ELSIF NEW.direction = 'inbound' THEN
      UPDATE influencers
      SET total_emails_replied = total_emails_replied + 1,
          last_active_at = COALESCE(GREATEST(last_active_at, NEW.created_at), NEW.created_at)
      WHERE id = NEW.influencer_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.opened_at IS NULL AND NEW.opened_at IS NOT NULL THEN
      UPDATE influencers
      SET total_emails_opened = total_emails_opened + 1
      WHERE id = NEW.influencer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER tr_email_metrics AFTER INSERT OR UPDATE ON email_messages
    FOR EACH ROW EXECUTE FUNCTION update_influencer_email_metrics();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Commission recalculation on payment
CREATE OR REPLACE FUNCTION on_user_payment(
  p_user_id UUID,
  p_amount_cents BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id UUID;
  v_commission_cents BIGINT;
BEGIN
  SELECT influencer_id INTO v_referrer_id
  FROM affiliate_referrals
  WHERE user_id = p_user_id AND status NOT IN ('refunded', 'disputed');

  IF v_referrer_id IS NULL THEN RETURN; END IF;

  v_commission_cents := (p_amount_cents * 30) / 100;

  UPDATE affiliate_referrals
  SET total_revenue_cents = total_revenue_cents + p_amount_cents,
      total_commission_cents = total_commission_cents + v_commission_cents,
      first_paid_at = COALESCE(first_paid_at, now()),
      status = CASE WHEN status = 'attributed' THEN 'paying' ELSE status END,
      updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE influencers
  SET total_commission_earned_cents = total_commission_earned_cents + v_commission_cents,
      total_paying_referrals = (
        SELECT COUNT(*) FROM affiliate_referrals
        WHERE influencer_id = v_referrer_id AND status = 'paying'
      )
  WHERE id = v_referrer_id;

  INSERT INTO funnel_events(influencer_id, user_id, event_type, event_metadata, occurred_at)
  VALUES (v_referrer_id, p_user_id, 'commission_calculated',
    jsonb_build_object('amount_cents', v_commission_cents, 'payment_cents', p_amount_cents),
    now()
  );
END;
$$;

-- Add referred_by_influencer_id to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referred_by_influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by_influencer_id) WHERE referred_by_influencer_id IS NOT NULL;

-- ============================================
-- V1 VIEWS
-- ============================================

CREATE OR REPLACE VIEW v_influencer_funnel_stats AS
SELECT
  status,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE status_changed_at > now() - interval '7 days') AS new_this_week,
  COUNT(*) FILTER (WHERE status_changed_at > now() - interval '30 days') AS new_this_month,
  AVG(lead_score)::INTEGER AS avg_lead_score
FROM influencers
WHERE status NOT IN ('declined', 'blocked')
GROUP BY status
ORDER BY array_position(
  ARRAY['unqualified','cold','queued','contacted','opened','replied','interested','demo_sent','evaluating','onboarded','active','paying','dormant']::TEXT[],
  status
);

CREATE OR REPLACE VIEW v_active_affiliates_leaderboard AS
SELECT
  i.id,
  i.display_name,
  i.email,
  i.affiliate_code,
  i.total_referrals,
  i.total_paying_referrals,
  i.total_commission_earned_cents,
  i.total_commission_paid_cents,
  (i.total_commission_earned_cents - i.total_commission_paid_cents) AS pending_commission_cents,
  COUNT(ar.id) FILTER (WHERE ar.signed_up_at > now() - interval '30 days') AS new_referrals_this_month,
  COUNT(ar.id) FILTER (WHERE ar.first_paid_at > now() - interval '30 days') AS new_paying_this_month,
  i.last_active_at
FROM influencers i
LEFT JOIN affiliate_referrals ar ON ar.influencer_id = i.id
WHERE i.affiliate_code IS NOT NULL
  AND i.status IN ('onboarded', 'active', 'paying')
GROUP BY i.id
ORDER BY i.total_commission_earned_cents DESC;

CREATE OR REPLACE VIEW v_daily_funnel_metrics AS
SELECT
  date_trunc('day', occurred_at)::date AS day,
  event_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT influencer_id) AS unique_influencers
FROM funnel_events
WHERE occurred_at > now() - interval '90 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE OR REPLACE VIEW v_payout_summary_current_month AS
SELECT
  COUNT(DISTINCT influencer_id) AS unique_affiliates,
  SUM(gross_commission_cents)::BIGINT AS total_gross_cents,
  SUM(adjustments_cents)::BIGINT AS total_adjustments_cents,
  SUM(net_payout_cents)::BIGINT AS total_net_cents,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'on_hold') AS on_hold_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
FROM affiliate_payouts
WHERE period_start_at >= date_trunc('month', now());
