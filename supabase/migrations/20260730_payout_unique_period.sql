-- Prevent duplicate payouts for the same influencer + period.
-- Canceled payouts are excluded (they can be re-created).
-- This prevents the double-payout bug where pending_review payouts
-- were re-processed on the next monthly run.

CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_payouts_influencer_period
  ON affiliate_payouts (influencer_id, period_start_at)
  WHERE status != 'canceled';

-- Clean up any existing duplicates first (keep the most recent per period)
DELETE FROM affiliate_payouts a
USING affiliate_payouts b
WHERE a.influencer_id = b.influencer_id
  AND a.period_start_at = b.period_start_at
  AND a.status != 'canceled'
  AND b.status != 'canceled'
  AND a.created_at < b.created_at;
