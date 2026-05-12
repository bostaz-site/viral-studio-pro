-- Migration 8: Affiliate commission ledger — IMMUTABLE
-- One row per event (payment/refund/chargeback/adjustment). No modifiable totals.
-- service_role ONLY for writes. No client-side INSERT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.affiliate_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE RESTRICT,
  referral_id UUID REFERENCES affiliate_referrals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'payment_earned',
    'refund_clawback',
    'chargeback_clawback',
    'manual_adjustment',
    'payout_deduction',
    'expiration_writeoff'
  )),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  payout_id UUID REFERENCES affiliate_payouts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  webhook_event_id UUID REFERENCES webhook_events(id)
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_influencer_time
  ON affiliate_commission_ledger(influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_event_type
  ON affiliate_commission_ledger(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_payout
  ON affiliate_commission_ledger(payout_id) WHERE payout_id IS NOT NULL;

-- Aggregated balance view (replaces modifiable totals)
CREATE OR REPLACE VIEW v_affiliate_balances AS
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
