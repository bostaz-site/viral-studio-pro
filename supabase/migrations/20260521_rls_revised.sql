-- Migration 19: RLS revised — capability-based permissions + RPC functions
-- VA/ops use RPCs (not direct UPDATE). Owner gets full access.
-- Commission ledger: NO UPDATE/DELETE policies (immutable, service_role only writes)

-- ============================================
-- ENABLE RLS ON ALL ADMIN TABLES
-- ============================================

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
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailbox_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_enrichment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_activation_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INFLUENCERS — SELECT wide, UPDATE owner only (others via RPC)
-- ============================================

DROP POLICY IF EXISTS influencers_select ON influencers;
CREATE POLICY influencers_select ON influencers
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS influencers_insert ON influencers;
CREATE POLICY influencers_insert ON influencers
  FOR INSERT WITH CHECK (can_manage_crm());

DROP POLICY IF EXISTS influencers_update_owner ON influencers;
CREATE POLICY influencers_update_owner ON influencers
  FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());

DROP POLICY IF EXISTS influencers_delete ON influencers;
CREATE POLICY influencers_delete ON influencers
  FOR DELETE USING (is_owner());

-- Affiliate self-service: see own profile
DROP POLICY IF EXISTS affiliate_view_own ON influencers;
CREATE POLICY affiliate_view_own ON influencers
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::CITEXT
  );

-- ============================================
-- EMAIL CAMPAIGNS
-- ============================================

DROP POLICY IF EXISTS campaigns_select ON email_campaigns;
CREATE POLICY campaigns_select ON email_campaigns
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS campaigns_mutate ON email_campaigns;
CREATE POLICY campaigns_mutate ON email_campaigns
  FOR ALL USING (can_manage_campaigns()) WITH CHECK (can_manage_campaigns());

-- ============================================
-- EMAIL TEMPLATES
-- ============================================

DROP POLICY IF EXISTS templates_select ON email_templates;
CREATE POLICY templates_select ON email_templates
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS templates_mutate ON email_templates;
CREATE POLICY templates_mutate ON email_templates
  FOR ALL USING (can_manage_campaigns()) WITH CHECK (can_manage_campaigns());

-- ============================================
-- EMAIL SEQUENCES
-- ============================================

DROP POLICY IF EXISTS sequences_select ON email_sequences;
CREATE POLICY sequences_select ON email_sequences
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS sequences_mutate ON email_sequences;
CREATE POLICY sequences_mutate ON email_sequences
  FOR ALL USING (can_manage_campaigns()) WITH CHECK (can_manage_campaigns());

-- ============================================
-- MAILBOXES — credentials visible to owner only (via view)
-- ============================================

DROP POLICY IF EXISTS mailboxes_select ON mailboxes;
CREATE POLICY mailboxes_select ON mailboxes
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS mailboxes_mutate ON mailboxes;
CREATE POLICY mailboxes_mutate ON mailboxes
  FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- ============================================
-- EMAIL MESSAGES
-- ============================================

DROP POLICY IF EXISTS messages_select ON email_messages;
CREATE POLICY messages_select ON email_messages
  FOR SELECT USING (can_view_inbox());

DROP POLICY IF EXISTS messages_mutate ON email_messages;
CREATE POLICY messages_mutate ON email_messages
  FOR ALL USING (can_manage_crm()) WITH CHECK (can_manage_crm());

-- ============================================
-- DEMO PACKAGES
-- ============================================

DROP POLICY IF EXISTS demos_select ON demo_packages;
CREATE POLICY demos_select ON demo_packages
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS demos_mutate ON demo_packages;
CREATE POLICY demos_mutate ON demo_packages
  FOR ALL USING (can_manage_crm()) WITH CHECK (can_manage_crm());

-- ============================================
-- AFFILIATE REFERRALS
-- ============================================

DROP POLICY IF EXISTS referrals_select ON affiliate_referrals;
CREATE POLICY referrals_select ON affiliate_referrals
  FOR SELECT USING (can_view_finance() OR can_view_crm());

DROP POLICY IF EXISTS referrals_mutate ON affiliate_referrals;
CREATE POLICY referrals_mutate ON affiliate_referrals
  FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- Affiliate self-service: see own referrals
DROP POLICY IF EXISTS affiliate_view_own_referrals ON affiliate_referrals;
CREATE POLICY affiliate_view_own_referrals ON affiliate_referrals
  FOR SELECT USING (
    influencer_id IN (
      SELECT id FROM influencers WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::CITEXT
    )
  );

-- ============================================
-- AFFILIATE PAYOUTS — finance only
-- ============================================

DROP POLICY IF EXISTS payouts_select ON affiliate_payouts;
CREATE POLICY payouts_select ON affiliate_payouts
  FOR SELECT USING (can_view_finance());

DROP POLICY IF EXISTS payouts_mutate ON affiliate_payouts;
CREATE POLICY payouts_mutate ON affiliate_payouts
  FOR ALL USING (can_manage_payouts()) WITH CHECK (can_manage_payouts());

-- Affiliate self-service: see own payouts
DROP POLICY IF EXISTS affiliate_view_own_payouts ON affiliate_payouts;
CREATE POLICY affiliate_view_own_payouts ON affiliate_payouts
  FOR SELECT USING (
    influencer_id IN (
      SELECT id FROM influencers WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::CITEXT
    )
  );

-- ============================================
-- COMMISSION LEDGER — IMMUTABLE: SELECT only, no INSERT/UPDATE/DELETE via client
-- Only service_role writes (bypasses RLS)
-- ============================================

DROP POLICY IF EXISTS ledger_select ON affiliate_commission_ledger;
CREATE POLICY ledger_select ON affiliate_commission_ledger
  FOR SELECT USING (can_view_finance());

-- NO INSERT/UPDATE/DELETE policies = client cannot write. service_role bypasses RLS.

-- ============================================
-- FUNNEL EVENTS
-- ============================================

DROP POLICY IF EXISTS events_select ON funnel_events;
CREATE POLICY events_select ON funnel_events
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS events_insert ON funnel_events;
CREATE POLICY events_insert ON funnel_events
  FOR INSERT WITH CHECK (can_manage_crm());

-- ============================================
-- ADMIN AUDIT LOG
-- ============================================

DROP POLICY IF EXISTS audit_select ON admin_audit_log;
CREATE POLICY audit_select ON admin_audit_log
  FOR SELECT USING (is_admin_any());

DROP POLICY IF EXISTS audit_insert ON admin_audit_log;
CREATE POLICY audit_insert ON admin_audit_log
  FOR INSERT WITH CHECK (is_admin_any());

-- ============================================
-- ADMIN USERS — owner only management
-- ============================================

DROP POLICY IF EXISTS admin_users_select ON admin_users;
CREATE POLICY admin_users_select ON admin_users
  FOR SELECT USING (is_admin_any());

DROP POLICY IF EXISTS admin_users_mutate ON admin_users;
CREATE POLICY admin_users_mutate ON admin_users
  FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- ============================================
-- SUPPRESSION LIST
-- ============================================

DROP POLICY IF EXISTS suppression_select ON suppression_list;
CREATE POLICY suppression_select ON suppression_list
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS suppression_mutate ON suppression_list;
CREATE POLICY suppression_mutate ON suppression_list
  FOR ALL USING (can_manage_crm()) WITH CHECK (can_manage_crm());

-- ============================================
-- WEBHOOK EVENTS
-- ============================================

DROP POLICY IF EXISTS webhooks_select ON webhook_events;
CREATE POLICY webhooks_select ON webhook_events
  FOR SELECT USING (is_admin_any());

-- INSERT via service_role only (webhook handlers)

-- ============================================
-- CAMPAIGN RECIPIENTS
-- ============================================

DROP POLICY IF EXISTS recipients_select ON campaign_recipients;
CREATE POLICY recipients_select ON campaign_recipients
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS recipients_mutate ON campaign_recipients;
CREATE POLICY recipients_mutate ON campaign_recipients
  FOR ALL USING (can_manage_campaigns()) WITH CHECK (can_manage_campaigns());

-- ============================================
-- EMAIL EVENTS
-- ============================================

DROP POLICY IF EXISTS email_events_select ON email_events;
CREATE POLICY email_events_select ON email_events
  FOR SELECT USING (can_view_crm());

-- INSERT via service_role (webhook handlers)

-- ============================================
-- AFFILIATE CLICKS
-- ============================================

DROP POLICY IF EXISTS clicks_select ON affiliate_clicks;
CREATE POLICY clicks_select ON affiliate_clicks
  FOR SELECT USING (can_view_finance() OR can_view_crm());

-- INSERT via service_role (redirect handler)

-- ============================================
-- FRAUD FLAGS — finance + ops can see, owner resolves
-- ============================================

DROP POLICY IF EXISTS fraud_select ON fraud_flags;
CREATE POLICY fraud_select ON fraud_flags
  FOR SELECT USING (can_view_finance() OR can_manage_crm());

DROP POLICY IF EXISTS fraud_resolve ON fraud_flags;
CREATE POLICY fraud_resolve ON fraud_flags
  FOR UPDATE USING (is_owner());

-- ============================================
-- PAYOUT HOLDS
-- ============================================

DROP POLICY IF EXISTS holds_select ON payout_holds;
CREATE POLICY holds_select ON payout_holds
  FOR SELECT USING (can_view_finance());

DROP POLICY IF EXISTS holds_mutate ON payout_holds;
CREATE POLICY holds_mutate ON payout_holds
  FOR ALL USING (can_manage_payouts()) WITH CHECK (can_manage_payouts());

-- ============================================
-- IMPORT BATCHES
-- ============================================

DROP POLICY IF EXISTS imports_select ON import_batches;
CREATE POLICY imports_select ON import_batches
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS imports_mutate ON import_batches;
CREATE POLICY imports_mutate ON import_batches
  FOR ALL USING (can_manage_crm()) WITH CHECK (can_manage_crm());

-- ============================================
-- DOMAINS
-- ============================================

DROP POLICY IF EXISTS domains_select ON domains;
CREATE POLICY domains_select ON domains
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS domains_mutate ON domains;
CREATE POLICY domains_mutate ON domains
  FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- ============================================
-- MAILBOX DAILY STATS
-- ============================================

DROP POLICY IF EXISTS mailbox_stats_select ON mailbox_daily_stats;
CREATE POLICY mailbox_stats_select ON mailbox_daily_stats
  FOR SELECT USING (can_view_crm());

-- INSERT via service_role (cron/webhook)

-- ============================================
-- LEAD ENRICHMENT
-- ============================================

DROP POLICY IF EXISTS enrichment_select ON lead_enrichment_snapshots;
CREATE POLICY enrichment_select ON lead_enrichment_snapshots
  FOR SELECT USING (can_view_crm());

DROP POLICY IF EXISTS enrichment_mutate ON lead_enrichment_snapshots;
CREATE POLICY enrichment_mutate ON lead_enrichment_snapshots
  FOR ALL USING (can_manage_crm()) WITH CHECK (can_manage_crm());

-- ============================================
-- UNSUBSCRIBE TOKENS — service_role only
-- ============================================

-- No user-facing policies. service_role handles token creation and lookup.

-- ============================================
-- PRODUCT ACTIVATION EVENTS
-- ============================================

DROP POLICY IF EXISTS activation_select ON product_activation_events;
CREATE POLICY activation_select ON product_activation_events
  FOR SELECT USING (can_view_crm() OR can_view_finance());

-- INSERT via service_role only (app code)

-- ============================================
-- SAFE VIEWS (mask sensitive data per role)
-- ============================================

-- Mailboxes: hide credentials from non-owners
CREATE OR REPLACE VIEW v_mailboxes_safe AS
SELECT
  id, email, display_name, domain, provider, status,
  daily_send_limit, emails_sent_today, total_emails_sent,
  bounce_rate_pct, complaint_rate_pct,
  spf_valid, dkim_valid, dmarc_valid,
  reputation_score, created_at,
  CASE WHEN is_owner() THEN credentials_encrypted ELSE NULL END AS credentials_encrypted
FROM mailboxes;

-- Email messages: VAs see preview only, not full body
CREATE OR REPLACE VIEW v_email_messages_safe AS
SELECT
  id, influencer_id, campaign_id, mailbox_id, direction,
  subject, message_id_external, thread_id,
  sent_at, delivered_at, opened_at, first_opened_at,
  clicked_at, replied_at, bounced_at, unsubscribed_at,
  bounce_type, bounce_reason,
  ai_sentiment, ai_intent, ai_classified_at, ai_confidence,
  is_read, is_archived, is_starred,
  created_at, updated_at,
  CASE WHEN can_view_inbox_bodies() THEN body_text ELSE LEFT(body_text, 200) || '...' END AS body_text,
  CASE WHEN can_view_inbox_bodies() THEN body_html ELSE NULL END AS body_html
FROM email_messages;

-- ============================================
-- RPC FUNCTIONS — controlled field updates for VA/ops
-- ============================================

-- Update influencer status (VA/ops)
CREATE OR REPLACE FUNCTION update_influencer_status(
  p_influencer_id UUID,
  p_new_status TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT can_manage_crm() THEN
    RAISE EXCEPTION 'Permission denied: requires CRM access';
  END IF;

  UPDATE influencers
  SET status = p_new_status,
      status_changed_at = now(),
      updated_at = now()
  WHERE id = p_influencer_id;

  INSERT INTO admin_audit_log (
    actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    auth.uid(), 'status_change', 'influencer', p_influencer_id,
    jsonb_build_object('new_status', p_new_status)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update influencer notes (VA/ops)
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

-- Add tag (VA/ops)
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

-- Remove tag (VA/ops)
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

-- Add to suppression list (VA/ops)
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
    p_email::CITEXT,
    p_reason,
    'manual',
    auth.uid(),
    jsonb_build_object('notes', p_notes)
  )
  ON CONFLICT (email) WHERE email IS NOT NULL DO NOTHING
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual ledger adjustment (owner only, full audit)
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

  INSERT INTO admin_audit_log (
    actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    auth.uid(), 'manual_ledger_adjustment', 'commission_ledger', new_id,
    jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason)
  );

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
