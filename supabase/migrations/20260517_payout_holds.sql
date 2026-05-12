-- Migration 10: Payout holds — refund window enforcement
-- Holds commissions for 30 days before they become payable

CREATE TABLE IF NOT EXISTS public.payout_holds (
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

CREATE INDEX IF NOT EXISTS idx_payout_holds_pending
  ON payout_holds(held_until) WHERE released_at IS NULL;
