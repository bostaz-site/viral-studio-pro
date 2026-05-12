-- Migration 7: Affiliate clicks — server-side attribution
-- Uses ip_hash (NOT raw IP) for privacy. Backup for Safari/iOS cookie blocking.

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code TEXT NOT NULL,
  influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL,
  -- Privacy: ip_hash = sha256(ip + pepper), NEVER store raw IP
  ip_hash TEXT,
  ip_country TEXT,
  user_agent TEXT,
  fingerprint_hash TEXT,
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_path TEXT,
  signup_completed_at TIMESTAMPTZ,
  signup_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code_time
  ON affiliate_clicks(affiliate_code, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_fingerprint
  ON affiliate_clicks(fingerprint_hash, clicked_at DESC)
  WHERE fingerprint_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_signup
  ON affiliate_clicks(signup_user_id) WHERE signup_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_iphash
  ON affiliate_clicks(ip_hash, clicked_at DESC) WHERE ip_hash IS NOT NULL;

-- Retention cleanup: delete clicks > 90 days that didn't convert
CREATE OR REPLACE FUNCTION cleanup_old_affiliate_clicks() RETURNS VOID AS $$
  DELETE FROM affiliate_clicks
  WHERE clicked_at < now() - interval '90 days'
    AND signup_user_id IS NULL;
$$ LANGUAGE SQL;
