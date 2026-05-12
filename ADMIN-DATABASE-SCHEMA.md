# 🗄️ ADMIN — Database Schema v2.0 (Supabase Postgres)

> Toutes les tables, indexes, RLS policies, triggers et migrations nécessaires pour le côté admin de Viral Animal.
>
> **v2.0 ajoute** (basé sur review externe) : `suppression_list`, `webhook_events` (idempotency), `affiliate_commission_ledger` (immuable), `admin_users` + rôles, `ai_calls`, `import_batches`, `domains`, `mailbox_daily_stats`, `campaign_recipients`, `email_events`, `affiliate_clicks`, `fraud_flags`, `payout_holds`, `lead_enrichment_snapshots` + indexes critiques.

---

## 📋 Sommaire

1. [Tables principales](#tables-principales)
2. [Tables relationnelles](#tables-relationnelles)
3. [Tables événementielles](#tables-événementielles)
4. [Vues SQL utiles](#vues-sql-utiles)
5. [RLS Policies](#rls-policies)
6. [Triggers & Functions](#triggers--functions)
7. [Migrations en ordre](#migrations-en-ordre)
8. [v2.0 — Nouvelles tables critiques](#v20--nouvelles-tables-critiques)
9. [v2.0 — Indexes Postgres critiques](#v20--indexes-postgres-critiques)
10. [v2.0 — Rôles admin & RLS révisée](#v20--rôles-admin--rls-révisée)

---

## Tables Principales

### `influencers` — La table cœur du CRM

```sql
CREATE TABLE public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,  -- comme affiché publiquement
  
  -- Platform info
  primary_platform TEXT CHECK (primary_platform IN (
    'twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other'
  )),
  platform_handle TEXT,  -- @samy_streams, etc.
  platform_url TEXT,
  audience_size INTEGER,  -- followers/subscribers
  niche TEXT,  -- 'gaming', 'fitness', 'business', 'beauty', etc.
  language TEXT DEFAULT 'en',  -- ISO 639-1
  country TEXT,  -- ISO 3166-1 alpha-2
  timezone TEXT,  -- 'America/New_York'
  
  -- Pipeline status (the big one)
  status TEXT NOT NULL DEFAULT 'cold' CHECK (status IN (
    'unqualified',
    'cold',
    'queued',
    'contacted',
    'opened',
    'replied',
    'interested',
    'demo_sent',
    'evaluating',
    'onboarded',
    'active',
    'paying',
    'dormant',
    'declined',
    'blocked'
  )),
  status_changed_at TIMESTAMPTZ DEFAULT now(),
  
  -- Lead scoring (computed)
  lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lead_score_reasons JSONB DEFAULT '[]'::jsonb,
  estimated_value_usd NUMERIC(10, 2),
  
  -- Affiliate (null until onboarded)
  affiliate_code TEXT UNIQUE,
  stripe_connect_account_id TEXT,
  stripe_connect_status TEXT CHECK (stripe_connect_status IN (
    'not_created', 'pending_kyc', 'active', 'restricted', 'rejected'
  )),
  
  -- Aggregated metrics (denormalized, updated by triggers)
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
  notes TEXT,  -- markdown
  source TEXT,  -- 'cold_email_campaign_v2', 'manual_import', 'inbound', 'referral'
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Compliance
  unsubscribed BOOLEAN DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  gdpr_consent BOOLEAN DEFAULT FALSE,
  data_retention_until TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_influencers_status ON influencers(status);
CREATE INDEX idx_influencers_email ON influencers(email);
CREATE INDEX idx_influencers_affiliate_code ON influencers(affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE INDEX idx_influencers_lead_score ON influencers(lead_score DESC) WHERE status NOT IN ('declined', 'blocked');
CREATE INDEX idx_influencers_niche ON influencers(niche);
CREATE INDEX idx_influencers_platform ON influencers(primary_platform);
CREATE INDEX idx_influencers_tags ON influencers USING GIN (tags);
CREATE INDEX idx_influencers_last_active ON influencers(last_active_at DESC);
```

### `email_campaigns` — Les campagnes d'envoi

```sql
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'archived'
  )),
  
  -- Targeting
  target_segment JSONB,  -- {"platform": "twitch", "audience_min": 1000, ...}
  
  -- Schedule
  scheduled_start_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Sequence config
  sequence_steps JSONB NOT NULL,  -- array of {step_index, delay_days, template_id, ...}
  
  -- A/B testing
  ab_variants JSONB,  -- array of variants with weights
  
  -- Aggregated metrics
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,  -- moved to status='interested' or beyond
  
  -- Instantly external IDs
  instantly_campaign_id TEXT UNIQUE,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON email_campaigns(scheduled_start_at) WHERE status = 'scheduled';
```

### `email_templates` — Templates réutilisables

```sql
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,  -- 'cold_outreach', 'follow_up', 'demo_sent', 'onboarding'
  
  -- Content
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,  -- plain text (for clients without HTML)
  body_html TEXT,  -- optional HTML version
  
  -- Variables docs
  variables JSONB,  -- {"first_name": "string", "demo_url": "url", ...}
  
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES email_templates(id),
  
  -- Performance (denormalized, updated periodically)
  times_used INTEGER DEFAULT 0,
  avg_open_rate NUMERIC(5, 2),
  avg_reply_rate NUMERIC(5, 2),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### `email_sequences` — Sequences = multi-step campaigns

```sql
-- (Optionnel : peut être inclus dans email_campaigns.sequence_steps)
-- Si on veut une table dédiée pour réutiliser les sequences :

CREATE TABLE public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Steps (linked to email_templates)
  steps JSONB NOT NULL,
  -- Example: [
  --   { "step": 1, "delay_days": 0, "template_id": "uuid", "ab_test": false },
  --   { "step": 2, "delay_days": 3, "template_id": "uuid", "condition": "not_opened" },
  --   { "step": 3, "delay_days": 7, "template_id": "uuid", "is_breakup": true }
  -- ]
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### `mailboxes` — Comptes sender (Zoho, Maildoso, etc.)

```sql
CREATE TABLE public.mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  domain TEXT NOT NULL,
  
  -- Provider
  provider TEXT CHECK (provider IN (
    'zoho', 'maildoso', 'gmail', 'outlook365', 'other'
  )),
  
  -- Credentials (encrypted)
  imap_host TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  credentials_encrypted TEXT,  -- AES encrypted password/app password
  
  -- Status & health
  status TEXT NOT NULL DEFAULT 'warming' CHECK (status IN (
    'warming', 'active', 'paused', 'blocked', 'rate_limited', 'retired'
  )),
  last_health_check_at TIMESTAMPTZ,
  reputation_score INTEGER DEFAULT 70 CHECK (reputation_score BETWEEN 0 AND 100),
  
  -- Volume tracking
  daily_send_limit INTEGER DEFAULT 30,
  emails_sent_today INTEGER DEFAULT 0,
  total_emails_sent INTEGER DEFAULT 0,
  
  -- Bounces / complaints
  bounce_rate_pct NUMERIC(5, 2) DEFAULT 0,
  complaint_rate_pct NUMERIC(5, 2) DEFAULT 0,
  
  -- DNS health (cached check)
  spf_valid BOOLEAN,
  dkim_valid BOOLEAN,
  dmarc_valid BOOLEAN,
  last_dns_check_at TIMESTAMPTZ,
  
  -- Instantly mapping
  instantly_account_id TEXT UNIQUE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  retired_at TIMESTAMPTZ
);

CREATE INDEX idx_mailboxes_status ON mailboxes(status);
CREATE INDEX idx_mailboxes_domain ON mailboxes(domain);
```

---

## Tables Relationnelles

### `email_messages` — Chaque email envoyé/reçu

```sql
CREATE TABLE public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linked entities
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE SET NULL,
  in_reply_to_message_id UUID REFERENCES email_messages(id),  -- threading
  
  -- Direction
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  
  -- Content
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  
  -- Tracking
  message_id_external TEXT,  -- Message-ID header
  thread_id TEXT,  -- pour grouper conversations
  
  -- Events
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  
  -- Bounce/error details
  bounce_type TEXT,  -- 'hard', 'soft', 'spam'
  bounce_reason TEXT,
  
  -- AI classification (for inbound)
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'spam', 'hostile')),
  ai_intent TEXT,  -- 'interested', 'has_question', 'declined', 'unsubscribe', etc.
  ai_classified_at TIMESTAMPTZ,
  ai_confidence NUMERIC(3, 2),  -- 0.00 to 1.00
  
  -- User actions
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  human_response_drafted TEXT,  -- saved draft response
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_messages_influencer ON email_messages(influencer_id);
CREATE INDEX idx_messages_campaign ON email_messages(campaign_id);
CREATE INDEX idx_messages_direction_unread ON email_messages(direction, is_read) WHERE direction = 'inbound' AND is_archived = FALSE;
CREATE INDEX idx_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_messages_sentiment ON email_messages(ai_sentiment) WHERE ai_sentiment IS NOT NULL;
CREATE INDEX idx_messages_recent ON email_messages(created_at DESC);
```

### `demo_packages` — Démos personnalisées générées

```sql
CREATE TABLE public.demo_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  
  -- Generation status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'fetching_clips', 'rendering', 'ready', 'failed', 'expired'
  )),
  
  -- Source clips fetched
  source_clips JSONB,  -- [{url, title, views, ...}, ...]
  
  -- Selected for rendering
  selected_clip_ids UUID[],  -- references to render_jobs.id
  
  -- Landing page
  landing_page_slug TEXT UNIQUE,  -- viralanimal.com/demo/[slug]
  landing_page_visits INTEGER DEFAULT 0,
  landing_page_first_visit_at TIMESTAMPTZ,
  
  -- Metrics
  avg_viral_score NUMERIC(5, 2),
  total_render_cost_cents INTEGER,  -- VPS cost tracking
  
  -- Audit
  generated_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- demo expires after 30 days
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_demos_influencer ON demo_packages(influencer_id);
CREATE INDEX idx_demos_status ON demo_packages(status);
CREATE INDEX idx_demos_slug ON demo_packages(landing_page_slug);
```

### `affiliate_referrals` — Attribution user → influencer

```sql
CREATE TABLE public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Attribution method
  attribution_type TEXT NOT NULL CHECK (attribution_type IN (
    'cookie', 'fingerprint', 'manual_assigned', 'magic_link'
  )),
  attribution_metadata JSONB,  -- {user_agent, ip_hash, referrer, ...}
  
  -- Lifecycle
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_paid_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'attributed' CHECK (status IN (
    'attributed',   -- user signed up, not yet paid
    'paying',       -- user is paying
    'churned',      -- user paid but cancelled
    'refunded',     -- payment refunded (commission claw back)
    'disputed'      -- chargeback / fraud suspected
  )),
  
  -- Cumulative tracking
  total_revenue_cents BIGINT DEFAULT 0,  -- total $ user has paid
  total_commission_cents BIGINT DEFAULT 0,  -- 30% of revenue
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- A user can only be referred by one influencer
CREATE UNIQUE INDEX idx_one_referral_per_user ON affiliate_referrals(user_id);
CREATE INDEX idx_referrals_influencer ON affiliate_referrals(influencer_id);
CREATE INDEX idx_referrals_status ON affiliate_referrals(status);
```

### `affiliate_payouts` — Versements Stripe Connect

```sql
CREATE TABLE public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  
  -- Period (monthly payouts)
  period_start_at TIMESTAMPTZ NOT NULL,
  period_end_at TIMESTAMPTZ NOT NULL,
  
  -- Amount
  gross_commission_cents BIGINT NOT NULL,
  adjustments_cents BIGINT DEFAULT 0,  -- clawbacks from refunds
  net_payout_cents BIGINT NOT NULL,
  
  -- Detail (snapshot of what's included)
  included_referral_ids UUID[],  -- array of affiliate_referrals.id
  referrals_count INTEGER NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- calculated, not yet sent
    'on_hold',     -- KYC missing or compliance issue
    'sending',     -- Stripe transfer initiated
    'sent',        -- successfully transferred
    'failed',      -- transfer failed
    'reversed'     -- transfer reversed
  )),
  
  -- Stripe
  stripe_transfer_id TEXT UNIQUE,
  stripe_transfer_status TEXT,
  failure_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_payouts_influencer ON affiliate_payouts(influencer_id);
CREATE INDEX idx_payouts_period ON affiliate_payouts(period_start_at, period_end_at);
CREATE INDEX idx_payouts_status ON affiliate_payouts(status);
```

---

## Tables Événementielles

### `funnel_events` — Tous les events pour analytics

```sql
CREATE TABLE public.funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Subject
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event
  event_type TEXT NOT NULL,
  -- Examples:
  --   'email_sent', 'email_opened', 'email_clicked', 'email_replied',
  --   'email_bounced', 'email_unsubscribed',
  --   'demo_generated', 'demo_viewed',
  --   'status_changed', 'tag_added', 'lead_score_changed',
  --   'affiliate_link_clicked', 'affiliate_signup', 'affiliate_first_paid',
  --   'commission_calculated', 'payout_sent',
  --   'manual_note_added', 'imported', 'merged'
  
  event_metadata JSONB,  -- arbitrary context for the event
  
  -- Linked entities (optional)
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  
  -- When
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Source
  source TEXT,  -- 'system', 'instantly_webhook', 'stripe_webhook', 'manual_admin'
  source_metadata JSONB
);

-- High write volume table — careful with indexes
CREATE INDEX idx_events_influencer_time ON funnel_events(influencer_id, occurred_at DESC);
CREATE INDEX idx_events_type_time ON funnel_events(event_type, occurred_at DESC);
CREATE INDEX idx_events_recent ON funnel_events(occurred_at DESC);

-- Partition by month if events get huge (deferred decision)
```

### `admin_audit_log` — Tout ce qui se passe côté admin

```sql
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  
  -- What
  action TEXT NOT NULL,
  -- Examples: 'influencer.status_changed', 'campaign.launched',
  --           'payout.sent', 'mailbox.created', 'data.exported'
  
  resource_type TEXT,  -- 'influencer', 'campaign', 'payout', etc.
  resource_id UUID,
  
  -- Details
  changes JSONB,  -- {"before": {...}, "after": {...}}
  metadata JSONB,
  
  -- When
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_user ON admin_audit_log(user_id);
CREATE INDEX idx_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_recent ON admin_audit_log(created_at DESC);
```

---

## Vues SQL Utiles

### `v_influencer_funnel_stats` — Stats live du funnel

```sql
CREATE VIEW v_influencer_funnel_stats AS
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
```

### `v_active_affiliates_leaderboard`

```sql
CREATE VIEW v_active_affiliates_leaderboard AS
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
```

### `v_daily_funnel_metrics`

```sql
CREATE VIEW v_daily_funnel_metrics AS
SELECT
  date_trunc('day', occurred_at)::date AS day,
  event_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT influencer_id) AS unique_influencers
FROM funnel_events
WHERE occurred_at > now() - interval '90 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### `v_payout_summary_current_month`

```sql
CREATE VIEW v_payout_summary_current_month AS
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
```

---

## RLS Policies

### Admin-only access by default

```sql
-- Enable RLS on all admin tables
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = ANY (string_to_array(current_setting('app.admin_emails', true), ','))
  );
$$;

-- Admin policies — full access for admin users
CREATE POLICY admin_all_access ON influencers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY admin_all_access ON email_campaigns
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ... (same pattern for all admin tables)
```

### Affiliate self-service access

```sql
-- Influencers (qui sont aussi des auth.users via magic link) peuvent voir LEUR OWN row + ses referrals + payouts

-- 1. Voir leur propre profil influencer
CREATE POLICY affiliate_view_own ON influencers
  FOR SELECT TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 2. Voir leurs propres referrals (anonymized — only counts, not user details)
CREATE POLICY affiliate_view_own_referrals ON affiliate_referrals
  FOR SELECT TO authenticated
  USING (
    influencer_id IN (
      SELECT id FROM influencers WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 3. Voir leurs propres payouts
CREATE POLICY affiliate_view_own_payouts ON affiliate_payouts
  FOR SELECT TO authenticated
  USING (
    influencer_id IN (
      SELECT id FROM influencers WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
```

---

## Triggers & Functions

### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
CREATE TRIGGER tr_influencers_updated_at BEFORE UPDATE ON influencers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ... (same for other tables)
```

### Auto-log status changes

```sql
CREATE OR REPLACE FUNCTION log_influencer_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO funnel_events(influencer_id, event_type, event_metadata, occurred_at)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'lead_score', NEW.lead_score
      ),
      now()
    );
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_influencer_status_change BEFORE UPDATE ON influencers
  FOR EACH ROW EXECUTE FUNCTION log_influencer_status_change();
```

### Aggregate metrics on email events

```sql
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

CREATE TRIGGER tr_email_metrics
  AFTER INSERT OR UPDATE ON email_messages
  FOR EACH ROW EXECUTE FUNCTION update_influencer_email_metrics();
```

### Commission recalculation when a payment happens

```sql
-- When a user pays, find their referrer and create/update commission
CREATE OR REPLACE FUNCTION on_user_payment(
  p_user_id UUID,
  p_amount_cents BIGINT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id UUID;
  v_commission_cents BIGINT;
BEGIN
  -- Find the referrer
  SELECT influencer_id INTO v_referrer_id
  FROM affiliate_referrals
  WHERE user_id = p_user_id AND status NOT IN ('refunded', 'disputed');
  
  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;
  
  v_commission_cents := (p_amount_cents * 30) / 100;
  
  -- Update referral
  UPDATE affiliate_referrals
  SET total_revenue_cents = total_revenue_cents + p_amount_cents,
      total_commission_cents = total_commission_cents + v_commission_cents,
      first_paid_at = COALESCE(first_paid_at, now()),
      status = CASE WHEN status = 'attributed' THEN 'paying' ELSE status END,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Update influencer aggregates
  UPDATE influencers
  SET total_commission_earned_cents = total_commission_earned_cents + v_commission_cents,
      total_paying_referrals = (
        SELECT COUNT(*) FROM affiliate_referrals
        WHERE influencer_id = v_referrer_id AND status = 'paying'
      )
  WHERE id = v_referrer_id;
  
  -- Log event
  INSERT INTO funnel_events(influencer_id, user_id, event_type, event_metadata, occurred_at)
  VALUES (v_referrer_id, p_user_id, 'commission_calculated',
    jsonb_build_object('amount_cents', v_commission_cents, 'payment_cents', p_amount_cents),
    now()
  );
END;
$$;
```

---

## Migrations en Ordre

### `2026XXXX_admin_core_tables.sql`
- influencers
- email_templates
- email_sequences
- mailboxes
- email_campaigns

### `2026XXXX_admin_messages_demos.sql`
- email_messages
- demo_packages

### `2026XXXX_admin_affiliate.sql`
- affiliate_referrals
- affiliate_payouts

### `2026XXXX_admin_events_audit.sql`
- funnel_events
- admin_audit_log

### `2026XXXX_admin_views.sql`
- All v_* views

### `2026XXXX_admin_rls.sql`
- Enable RLS + policies on all admin tables

### `2026XXXX_admin_triggers.sql`
- Triggers + functions

### `2026XXXX_admin_user_referral_field.sql`
- Add `referred_by_influencer_id` column to existing `profiles` table

```sql
ALTER TABLE public.profiles
ADD COLUMN referred_by_influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_referred_by ON profiles(referred_by_influencer_id) WHERE referred_by_influencer_id IS NOT NULL;
```

---

## Notes Importantes

### Performance considerations
- `funnel_events` peut devenir huge (millions de rows). Considérer **partitioning par mois** dès qu'on dépasse 1M rows.
- `email_messages` aussi gros. Si trop lourd, **archiver vers cold storage** (S3) après 6 mois.

### Backup
- Supabase fait des backups automatiques quotidiens (plan Pro). Suffisant pour MVP.
- À scale : exporter snapshots vers S3 hebdomadaire.

### Data sensitivity
- `email_messages.body_text` peut contenir PII. → encryption at rest (Supabase fait nativement).
- `mailboxes.credentials_encrypted` → never logged, never returned to client.

### Migration safety
- Toujours wrapper les migrations dans `BEGIN; ... COMMIT;` pour transactions atomiques.
- Tester sur staging Supabase avant prod.

---

*Document version 1.0 — Mai 2026 (voir section v2.0 ci-dessous pour les ajouts critiques)*
*Total tables estimé v1 : 12 nouvelles*
*Estimated DB size at 150k cold emails/mois : ~5GB après 6 mois*

---

## v2.0 — Nouvelles tables critiques

> Basé sur la review externe. Ces tables doivent être créées AVANT le D1 build (Vague 1 Semaine 1).

### `admin_users` — Rôles & permissions admin

Critique pour pouvoir ajouter des VAs sans casser la sécurité.

```sql
CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'ops', 'va', 'finance', 'readonly')),
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

CREATE INDEX idx_admin_users_role ON admin_users(role);
```

**Rôles & accès :**
- `owner` : tout (Samy)
- `ops` : CRM + inbox + campaigns, PAS payouts/credentials
- `va` : inbox + lead status + notes, PAS payouts/Stripe/credentials/exports
- `finance` : payouts + revenue + ledger, PAS inbox bodies
- `readonly` : dashboards uniquement

### `suppression_list` — Compliance globale (P0)

Empêche tout envoi à un email/domain même si réimporté dans une autre campagne.

```sql
CREATE TABLE public.suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  email_domain TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'unsubscribe', 'hard_bounce', 'soft_bounce_threshold',
    'complaint', 'manual_block', 'gdpr_request', 'fraud_flag'
  )),
  source TEXT,  -- 'instantly_webhook', 'manual', 'import', 'api'
  metadata JSONB DEFAULT '{}'::jsonb,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,  -- nullable = permanent

  CHECK (email IS NOT NULL OR email_domain IS NOT NULL)
);

CREATE UNIQUE INDEX idx_suppression_email_lower
  ON suppression_list (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_suppression_domain ON suppression_list(email_domain) WHERE email_domain IS NOT NULL;
CREATE INDEX idx_suppression_reason ON suppression_list(reason, added_at DESC);
```

**Function de check (à appeler avant export campagne) :**
```sql
CREATE OR REPLACE FUNCTION is_suppressed(p_email TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM suppression_list
    WHERE (lower(email) = lower(p_email)
       OR email_domain = split_part(p_email, '@', 2))
      AND (expires_at IS NULL OR expires_at > now())
  );
$$ LANGUAGE SQL STABLE;
```

### `webhook_events` — Idempotency layer (P0)

Empêche le double-comptage opens/replies/commissions/payouts si un provider renvoie le même event.

```sql
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN (
    'instantly', 'stripe', 'resend', 'smartlead', 'maildoso', 'manual'
  )),
  event_id TEXT NOT NULL,  -- l'ID que le provider nous envoie
  event_type TEXT NOT NULL,  -- 'reply', 'open', 'payment_succeeded', etc.
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,  -- sha256 du payload (verify tampering)
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'duplicate'
  )),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_status ON webhook_events(processing_status, received_at DESC);
CREATE INDEX idx_webhook_events_provider_type ON webhook_events(provider, event_type, received_at DESC);
```

**Pattern d'usage :**
```typescript
// 1. INSERT first avec ON CONFLICT DO NOTHING
// 2. Si insert réussit → process l'event
// 3. Si conflict → c'est un duplicate, ignore
```

### `campaign_recipients` — Lien influencer↔campaign↔step

Sans ça, impossible de savoir précisément qui est dans quelle étape de quelle séquence.

```sql
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  sequence_step INTEGER DEFAULT 0,  -- 0=initial, 1=follow-up #1, etc.
  mailbox_id UUID REFERENCES mailboxes(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'scheduled', 'sent', 'opened', 'clicked',
    'replied', 'bounced', 'unsubscribed', 'failed', 'skipped'
  )),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  external_id TEXT,  -- ID dans Instantly/Smartlead
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE (campaign_id, influencer_id, sequence_step)
);

CREATE INDEX idx_campaign_recipients_campaign_status
  ON campaign_recipients(campaign_id, status, scheduled_at);
CREATE INDEX idx_campaign_recipients_influencer
  ON campaign_recipients(influencer_id, sent_at DESC);
```

### `email_events` — Tous les events email (granular)

Séparé d'`email_messages` parce que un message peut avoir N events (sent, opened, clicked, replied, bounced).

```sql
CREATE TABLE public.email_events (
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
  webhook_event_id UUID REFERENCES webhook_events(id)  -- traçabilité
);

CREATE INDEX idx_email_events_campaign_type_time
  ON email_events(campaign_id, event_type, occurred_at DESC);
CREATE INDEX idx_email_events_influencer_time
  ON email_events(influencer_id, occurred_at DESC);
CREATE INDEX idx_email_events_message
  ON email_events(message_id) WHERE message_id IS NOT NULL;
```

### `affiliate_clicks` — Attribution server-side

Backup pour Safari/iOS qui bloquent third-party cookies.

```sql
CREATE TABLE public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code TEXT NOT NULL,
  influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL,
  ip_address INET,
  ip_country TEXT,
  user_agent TEXT,
  fingerprint_hash TEXT,  -- sha256(ip + ua + accept-lang)
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_path TEXT,
  signup_completed_at TIMESTAMPTZ,
  signup_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_affiliate_clicks_code_time
  ON affiliate_clicks(affiliate_code, clicked_at DESC);
CREATE INDEX idx_affiliate_clicks_fingerprint
  ON affiliate_clicks(fingerprint_hash, clicked_at DESC)
  WHERE fingerprint_hash IS NOT NULL;
CREATE INDEX idx_affiliate_clicks_signup
  ON affiliate_clicks(signup_user_id) WHERE signup_user_id IS NOT NULL;
```

### `affiliate_commission_ledger` — Ledger IMMUABLE

**Remplace les totals modifiables.** Une ligne par event (payment/refund/chargeback/adjustment).

```sql
CREATE TABLE public.affiliate_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE RESTRICT,
  referral_id UUID REFERENCES affiliate_referrals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Event source
  event_type TEXT NOT NULL CHECK (event_type IN (
    'payment_earned',      -- user paid → commission earned
    'refund_clawback',     -- user got refunded → claw back
    'chargeback_clawback', -- chargeback → claw back + flag
    'manual_adjustment',   -- correction manuelle (+/-)
    'payout_deduction',    -- payout payé → réduit le balance
    'expiration_writeoff'  -- vieilles commissions expirées
  )),

  -- Money
  amount_cents BIGINT NOT NULL,  -- positif = crédit pour affilié, négatif = débit
  currency TEXT NOT NULL DEFAULT 'usd',

  -- Stripe context
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  payout_id UUID REFERENCES affiliate_payouts(id) ON DELETE SET NULL,

  -- Audit (IMMUTABLE — pas d'UPDATE permis)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  webhook_event_id UUID REFERENCES webhook_events(id)
);

-- IMMUTABLE : empêcher UPDATE/DELETE via RLS
CREATE INDEX idx_commission_ledger_influencer_time
  ON affiliate_commission_ledger(influencer_id, created_at DESC);
CREATE INDEX idx_commission_ledger_event_type
  ON affiliate_commission_ledger(event_type, created_at DESC);
CREATE INDEX idx_commission_ledger_payout
  ON affiliate_commission_ledger(payout_id) WHERE payout_id IS NOT NULL;
```

**Vue agrégée pour balance courant :**
```sql
CREATE VIEW v_affiliate_balances AS
SELECT
  influencer_id,
  SUM(amount_cents) FILTER (WHERE event_type IN ('payment_earned', 'manual_adjustment'))
    AS earned_cents,
  SUM(amount_cents) FILTER (WHERE event_type IN ('refund_clawback', 'chargeback_clawback'))
    AS clawback_cents,
  SUM(amount_cents) FILTER (WHERE event_type = 'payout_deduction')
    AS paid_out_cents,
  SUM(amount_cents) AS available_balance_cents
FROM affiliate_commission_ledger
GROUP BY influencer_id;
```

### `fraud_flags` — Anti-fraude affiliés

```sql
CREATE TABLE public.fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'self_referral_email_match',
    'self_referral_ip_match',
    'self_referral_payment_match',
    'same_ip_cluster',
    'same_device_cluster',
    'rapid_signup_pattern',
    'chargeback_high_rate',
    'refund_high_rate',
    'manual_suspicion'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'cleared', 'confirmed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_fraud_flags_status_severity
  ON fraud_flags(status, severity, created_at DESC) WHERE status = 'open';
CREATE INDEX idx_fraud_flags_influencer
  ON fraud_flags(influencer_id) WHERE status = 'open';
```

### `payout_holds` — Refund window enforcement

```sql
CREATE TABLE public.payout_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_entry_id UUID NOT NULL REFERENCES affiliate_commission_ledger(id) ON DELETE CASCADE,
  hold_reason TEXT NOT NULL CHECK (hold_reason IN (
    'refund_window_30d', 'manual_review', 'first_payout',
    'fraud_check', 'kyc_pending'
  )),
  held_until TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_payout_holds_pending
  ON payout_holds(held_until) WHERE released_at IS NULL;
```

### `ai_calls` — Track Claude API usage

```sql
CREATE TABLE public.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,  -- 'reply_classification', 'lead_scoring', 'draft_reply', etc.
  model TEXT NOT NULL,  -- 'claude-haiku-4-5', 'claude-sonnet-4-6', etc.
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  cost_cents NUMERIC(10, 6),  -- prix calculé après l'appel
  latency_ms INTEGER,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  context_id UUID,  -- e.g. message_id, influencer_id selon le feature
  context_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ai_calls_feature_time
  ON ai_calls(feature, created_at DESC);
CREATE INDEX idx_ai_calls_cost
  ON ai_calls(created_at DESC, cost_cents);
```

### `import_batches` — Tracking des imports CSV

```sql
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  source TEXT NOT NULL,  -- 'csv_upload', 'apify_scrape', 'apollo_export'
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

CREATE INDEX idx_import_batches_user_time
  ON import_batches(imported_by, started_at DESC);
```

### `domains` — Cold email domain tracking

```sql
CREATE TABLE public.domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  registrar TEXT,  -- 'namecheap', 'cloudflare', etc.
  purchased_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cost_yearly_usd NUMERIC(8, 2),
  redirect_to TEXT,  -- usually 'viralanimal.com'
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

CREATE INDEX idx_domains_status ON domains(status);
```

### `mailbox_daily_stats` — Mailbox health monitoring

```sql
CREATE TABLE public.mailbox_daily_stats (
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
  reputation_score NUMERIC(5, 2),  -- 0-100
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE (mailbox_id, stat_date)
);

CREATE INDEX idx_mailbox_stats_date
  ON mailbox_daily_stats(mailbox_id, stat_date DESC);
```

### `lead_enrichment_snapshots` — Snapshots Apify/Apollo

```sql
CREATE TABLE public.lead_enrichment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apify', 'apollo', 'clearbit', 'manual')),
  raw_data JSONB NOT NULL,
  audience_size INTEGER,
  engagement_rate NUMERIC(5, 2),
  niche_detected TEXT,
  recent_posts_count INTEGER,
  last_post_at TIMESTAMPTZ,
  cost_cents NUMERIC(8, 4),
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_enrichment_influencer_time
  ON lead_enrichment_snapshots(influencer_id, fetched_at DESC);
```

---

## v2.0 — Indexes Postgres critiques

Ajouter aux tables existantes (v1) :

```sql
-- Email normalization (P0)
CREATE UNIQUE INDEX idx_influencers_email_lower
  ON influencers (lower(email));

-- Pipeline ops (frequently filtered/sorted)
CREATE INDEX idx_influencers_status_score
  ON influencers(status, lead_score DESC);

CREATE INDEX idx_influencers_status_changed
  ON influencers(status, status_changed_at DESC);

CREATE INDEX idx_influencers_source_created
  ON influencers(source, created_at DESC);

-- Email messages (high-volume table)
CREATE INDEX idx_messages_mailbox_sent
  ON email_messages(mailbox_id, sent_at DESC);

CREATE INDEX idx_messages_influencer_created
  ON email_messages(influencer_id, created_at DESC);

CREATE UNIQUE INDEX idx_messages_external_unique
  ON email_messages(message_id_external)
  WHERE message_id_external IS NOT NULL;

-- Funnel events (will get huge)
CREATE INDEX idx_funnel_events_campaign_type_time
  ON funnel_events(campaign_id, event_type, occurred_at DESC);

CREATE INDEX idx_funnel_events_message
  ON funnel_events(message_id) WHERE message_id IS NOT NULL;

-- Affiliate analytics
CREATE INDEX idx_referrals_influencer_status_paid
  ON affiliate_referrals(influencer_id, status, first_paid_at DESC);

CREATE INDEX idx_referrals_created
  ON affiliate_referrals(created_at DESC);

-- Payouts ops
CREATE INDEX idx_payouts_status_period
  ON affiliate_payouts(status, period_start_at DESC);
```

---

## v2.1 — Permissions explicites & RLS (FIX critique)

> **⚠️ Changement important vs v2.0** : la hiérarchie linéaire `has_role(min)` était dangereuse (finance > ops permettait à finance d'accéder à des trucs ops). On passe à des **permissions explicites orthogonales**.

### Helper functions — capability-based

```sql
-- Retourne le rôle de l'user courant (ou NULL si pas admin)
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM admin_users WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Capability-based helpers — orthogonaux, pas hiérarchiques
CREATE OR REPLACE FUNCTION can_manage_crm() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops', 'va');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_crm() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops', 'va', 'readonly');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_manage_campaigns() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_inbox() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'ops', 'va');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_inbox_bodies() RETURNS BOOLEAN AS $$
  -- VAs voient le sujet/preview, mais pas le body complet sensible
  SELECT auth_role() IN ('owner', 'ops');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_finance() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'finance');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_manage_payouts() RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('owner', 'finance');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION can_view_credentials() RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'owner';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'owner';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_admin_any() RETURNS BOOLEAN AS $$
  -- "Admin" = a un rôle quelconque dans admin_users
  SELECT auth_role() IS NOT NULL;
$$ LANGUAGE SQL STABLE;
```

### RLS policies — VA contraint via RPC, pas UPDATE direct

**Principe** : Pour les rôles non-owner, on ne permet PAS d'UPDATE direct sur les tables. Tout passe par des RPC sécurisées qui contrôlent exactement les colonnes modifiables.

```sql
-- influencers : SELECT large, INSERT/UPDATE/DELETE contraints
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY influencers_select ON influencers
  FOR SELECT USING (can_view_crm());

CREATE POLICY influencers_insert ON influencers
  FOR INSERT WITH CHECK (can_manage_crm());

-- UPDATE direct = owner uniquement. Les autres rôles passent par les RPC ci-dessous.
CREATE POLICY influencers_update_owner ON influencers
  FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());

CREATE POLICY influencers_delete ON influencers
  FOR DELETE USING (is_owner());
```

### RPC functions — contrôle exact des champs modifiables par les VAs

```sql
-- VA/ops peuvent changer le status d'un influencer via cette RPC
CREATE OR REPLACE FUNCTION update_influencer_status(
  p_influencer_id UUID,
  p_new_status TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT can_manage_crm() THEN
    RAISE EXCEPTION 'Permission denied: requires CRM access';
  END IF;

  -- Vérifier que le status est valide (check constraint le fera aussi)
  UPDATE influencers
  SET status = p_new_status,
      status_changed_at = now(),
      updated_at = now()
  WHERE id = p_influencer_id;

  -- Log dans audit
  INSERT INTO admin_audit_log (
    actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    auth.uid(), 'status_change', 'influencer', p_influencer_id,
    jsonb_build_object('new_status', p_new_status)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- VA/ops peuvent ajouter/changer notes
CREATE OR REPLACE FUNCTION update_influencer_notes(
  p_influencer_id UUID,
  p_notes TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT can_manage_crm() THEN
    RAISE EXCEPTION 'Permission denied: requires CRM access';
  END IF;

  UPDATE influencers
  SET notes = p_notes, updated_at = now()
  WHERE id = p_influencer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- VA/ops peuvent gérer les tags
CREATE OR REPLACE FUNCTION add_influencer_tag(
  p_influencer_id UUID,
  p_tag TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT can_manage_crm() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  UPDATE influencers
  SET tags = array_append(tags, p_tag), updated_at = now()
  WHERE id = p_influencer_id AND NOT (p_tag = ANY(tags));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION remove_influencer_tag(
  p_influencer_id UUID,
  p_tag TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT can_manage_crm() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  UPDATE influencers
  SET tags = array_remove(tags, p_tag), updated_at = now()
  WHERE id = p_influencer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suppression : VA/ops peuvent ajouter
CREATE OR REPLACE FUNCTION add_to_suppression(
  p_email TEXT,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  IF NOT can_manage_crm() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO suppression_list (email, reason, source, added_by, metadata)
  VALUES (
    lower(p_email),
    p_reason,
    'manual',
    auth.uid(),
    jsonb_build_object('notes', p_notes)
  )
  ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO NOTHING
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `affiliate_commission_ledger` — SERVICE_ROLE ONLY (FIX critique)

**Principe** : Personne (pas même finance) n'INSERT directement dans le ledger via API client. Le ledger est écrit par :
- Webhook handlers Stripe (via service_role)
- Payout jobs (via service_role)
- RPC `create_manual_ledger_adjustment()` avec audit complet

```sql
ALTER TABLE affiliate_commission_ledger ENABLE ROW LEVEL SECURITY;

-- SELECT : finance+ peut voir
CREATE POLICY ledger_select ON affiliate_commission_ledger
  FOR SELECT USING (can_view_finance());

-- PAS de policy INSERT/UPDATE/DELETE pour les rôles client
-- → Seul service_role peut écrire (bypass RLS par défaut)

-- Manuel adjustment : RPC seulement, owner only, full audit
CREATE OR REPLACE FUNCTION create_manual_ledger_adjustment(
  p_influencer_id UUID,
  p_amount_cents BIGINT,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Permission denied: owner only';
  END IF;

  INSERT INTO affiliate_commission_ledger (
    influencer_id, event_type, amount_cents, currency, created_by, notes
  ) VALUES (
    p_influencer_id, 'manual_adjustment', p_amount_cents, 'usd', auth.uid(), p_reason
  )
  RETURNING id INTO new_id;

  -- Audit log obligatoire pour les adjustments manuels
  INSERT INTO admin_audit_log (
    actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    auth.uid(), 'manual_ledger_adjustment', 'commission_ledger', new_id,
    jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason)
  );

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Autres tables sensibles

```sql
-- payout_holds, affiliate_payouts : finance only
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_select ON affiliate_payouts FOR SELECT USING (can_view_finance());
CREATE POLICY payouts_mutate ON affiliate_payouts FOR ALL USING (can_manage_payouts());

-- mailboxes : credentials accessibles owner only via view masquée
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mailboxes_select ON mailboxes
  FOR SELECT USING (can_view_crm());  -- ils voient la mailbox, pas les creds
CREATE POLICY mailboxes_mutate ON mailboxes
  FOR ALL USING (is_owner());

-- View pour cacher les credentials aux non-owners
CREATE VIEW v_mailboxes_safe AS
SELECT
  id, email_address, provider, status,
  daily_send_limit, current_send_today, created_at,
  CASE WHEN is_owner() THEN credentials_encrypted ELSE NULL END AS credentials_encrypted
FROM mailboxes;

-- email_messages.body : VAs ne voient que preview, pas le body complet
CREATE VIEW v_email_messages_safe AS
SELECT
  id, influencer_id, campaign_id, mailbox_id, direction,
  subject, message_id_external, sent_at, received_at, created_at,
  CASE WHEN can_view_inbox_bodies() THEN body_text ELSE LEFT(body_text, 200) || '...' END AS body_text,
  CASE WHEN can_view_inbox_bodies() THEN body_html ELSE NULL END AS body_html
FROM email_messages;

-- fraud_flags : finance + ops, mais resolved_by owner only
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY fraud_select ON fraud_flags
  FOR SELECT USING (can_view_finance() OR can_manage_crm());
CREATE POLICY fraud_resolve ON fraud_flags
  FOR UPDATE USING (is_owner());
```

### Migration des admin emails → admin_users

```sql
INSERT INTO admin_users (user_id, role)
SELECT u.id, 'owner'
FROM auth.users u
WHERE u.email IN (
  SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
)
ON CONFLICT (user_id) DO NOTHING;

-- L'ancien is_admin() reste pour backward compat, mais redirige vers le nouveau
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT is_admin_any();
$$ LANGUAGE SQL STABLE;
```

---

## v2.1 — Email column : CITEXT (FIX doublon)

> **⚠️ Changement** : `email TEXT UNIQUE` + `UNIQUE INDEX lower(email)` était un doublon. On utilise `CITEXT` (case-insensitive text) qui fait le UNIQUE case-insensitive nativement.

```sql
-- Migration pour la table influencers existante
CREATE EXTENSION IF NOT EXISTS citext;

-- Si email column est encore TEXT, convertir :
ALTER TABLE influencers
  ALTER COLUMN email TYPE CITEXT USING email::CITEXT;

-- Drop l'index lower(email) doublon
DROP INDEX IF EXISTS idx_influencers_email_lower;

-- Le UNIQUE constraint sur la colonne CITEXT est maintenant case-insensitive
-- Pas besoin d'index séparé.

-- Idem pour suppression_list
ALTER TABLE suppression_list
  ALTER COLUMN email TYPE CITEXT USING email::CITEXT;

DROP INDEX IF EXISTS idx_suppression_email_lower;
CREATE UNIQUE INDEX idx_suppression_email_unique
  ON suppression_list (email) WHERE email IS NOT NULL;
```

---

## v2.1 — Privacy hardening (FIX IP/fingerprint)

```sql
-- affiliate_clicks : hash l'IP avec pepper, pas en clair
-- Set ce pepper en env var: AFFILIATE_IP_PEPPER

-- À l'insert, l'app calcule:
-- ip_hash = sha256(ip || pepper)
-- ip_country reste (geolocation utile, pas sensible)

-- Migration : remplacer ip_address INET par ip_hash TEXT
ALTER TABLE affiliate_clicks
  DROP COLUMN ip_address,
  ADD COLUMN ip_hash TEXT;

CREATE INDEX idx_affiliate_clicks_iphash
  ON affiliate_clicks(ip_hash, clicked_at DESC) WHERE ip_hash IS NOT NULL;

-- Retention: trigger pour delete les clicks > 90 jours (sauf si converted)
CREATE OR REPLACE FUNCTION cleanup_old_affiliate_clicks() RETURNS VOID AS $$
  DELETE FROM affiliate_clicks
  WHERE clicked_at < now() - interval '90 days'
    AND signup_user_id IS NULL;
$$ LANGUAGE SQL;
-- À run via cron daily ou Inngest scheduled job
```

---

## v2.1 — Product Activation Events (ADD à Vague 1)

> Critique pour mesurer Signal 3 ("affiliate users → activation produit"). Sans ça, tu sais qui paie mais pas qui active.

```sql
CREATE TABLE public.product_activation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'user_signed_up',
    'email_verified',
    'first_platform_connected',
    'first_clip_imported',
    'first_clip_enhanced',
    'first_render_completed',
    'first_post_scheduled',
    'first_post_published',
    'trial_started',
    'trial_converted_paid',
    'subscription_canceled',
    'reactivated'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- Pour attribution affilié
  referred_by_influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL
);

CREATE INDEX idx_activation_user_event
  ON product_activation_events(user_id, event_name, occurred_at DESC);
CREATE INDEX idx_activation_event_time
  ON product_activation_events(event_name, occurred_at DESC);
CREATE INDEX idx_activation_referred
  ON product_activation_events(referred_by_influencer_id, event_name, occurred_at DESC)
  WHERE referred_by_influencer_id IS NOT NULL;

-- RLS : owner/finance peuvent voir tout
ALTER TABLE product_activation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY activation_select ON product_activation_events
  FOR SELECT USING (can_view_crm() OR can_view_finance());
-- INSERT via service_role only (depuis l'app)
```

**Vue d'activation par affilié** (pour Signal 3) :

```sql
CREATE VIEW v_affiliate_activation_stats AS
SELECT
  i.id AS influencer_id,
  i.display_name,
  COUNT(DISTINCT CASE WHEN e.event_name = 'user_signed_up' THEN e.user_id END) AS signups,
  COUNT(DISTINCT CASE WHEN e.event_name = 'first_render_completed' THEN e.user_id END) AS activated_users,
  COUNT(DISTINCT CASE WHEN e.event_name = 'trial_converted_paid' THEN e.user_id END) AS paying_users,
  ROUND(
    COUNT(DISTINCT CASE WHEN e.event_name = 'first_render_completed' THEN e.user_id END)::NUMERIC
    / NULLIF(COUNT(DISTINCT CASE WHEN e.event_name = 'user_signed_up' THEN e.user_id END), 0) * 100,
    1
  ) AS activation_rate_pct
FROM influencers i
LEFT JOIN product_activation_events e ON e.referred_by_influencer_id = i.id
WHERE i.affiliate_code IS NOT NULL
GROUP BY i.id, i.display_name;
```

**Helper côté app** (`lib/admin/track-activation.ts`) :

```typescript
export async function trackActivation(
  userId: string,
  eventName: ActivationEventName,
  metadata?: Record<string, unknown>
) {
  // Use admin client (service_role)
  // Lookup user's referred_by_influencer_id from profile
  // INSERT into product_activation_events
}
```

À appeler depuis :
- Signup flow → `user_signed_up`, `email_verified`
- Platform OAuth callback → `first_platform_connected` (idempotent)
- Render success → `first_render_completed` (idempotent)
- Stripe webhook → `trial_started`, `trial_converted_paid`, `subscription_canceled`

---

## v2.1 — Unsubscribe tokens (FIX privacy URL)

> **⚠️ Changement** : Au lieu de `/unsubscribe?email=...&token=...` (email en clair dans URL), on utilise un token signé qui REFERENCE l'email côté DB.

```sql
CREATE TABLE public.unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,  -- sha256 du token (jamais stocké en clair)
  email CITEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  source_campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL
);

CREATE INDEX idx_unsubscribe_tokens_email
  ON unsubscribe_tokens(email) WHERE used_at IS NULL;

-- Génération côté app :
-- token = randomBytes(32).toString('base64url')
-- token_hash = sha256(token)
-- URL = /unsubscribe?t=<token>
-- App lookup token_hash, get email, add to suppression_list
```

---

## v2.0 — Order of migrations (ajout)

À ajouter APRÈS les migrations v1 :

```
20260513_admin_users_roles.sql
20260513_suppression_list.sql
20260514_webhook_events.sql
20260514_campaign_recipients.sql
20260515_email_events.sql
20260515_affiliate_clicks.sql
20260516_commission_ledger.sql
20260516_fraud_flags.sql
20260517_payout_holds.sql
20260517_ai_calls.sql
20260518_import_batches.sql
20260518_domains_mailbox_stats.sql
20260519_lead_enrichment.sql
20260519_v2_indexes.sql
20260520_rls_revised.sql
```

---

*Document version 2.0 — Mai 2026*
*Total tables v2 : 12 v1 + 13 nouvelles = 25 tables*
*Indexes additionnels v2 : ~15 indexes critiques*
