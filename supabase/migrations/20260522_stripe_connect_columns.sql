-- Migration: Add Stripe Connect Express columns + update payout statuses
-- Supports: onboarding KYC tracking, manual review flow

-- Add Stripe Connect tracking columns to influencers
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT FALSE;

-- Update affiliate_payouts status CHECK to include pending_review and approved
ALTER TABLE affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_status_check;
ALTER TABLE affiliate_payouts ADD CONSTRAINT affiliate_payouts_status_check
  CHECK (status IN (
    'pending_review', 'approved', 'pending', 'on_hold',
    'sending', 'sent', 'failed', 'reversed'
  ));

-- Index for efficient payout queries by review status
CREATE INDEX IF NOT EXISTS idx_payouts_pending_review
  ON affiliate_payouts(created_at DESC) WHERE status = 'pending_review';
