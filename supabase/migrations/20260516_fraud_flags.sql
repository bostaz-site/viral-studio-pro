-- Migration 9: Fraud flags — anti-fraud tracking for affiliates

CREATE TABLE IF NOT EXISTS public.fraud_flags (
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

CREATE INDEX IF NOT EXISTS idx_fraud_flags_status_severity
  ON fraud_flags(status, severity, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_fraud_flags_influencer
  ON fraud_flags(influencer_id) WHERE status = 'open';
