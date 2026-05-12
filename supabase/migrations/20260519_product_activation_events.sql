-- Migration 16: Product activation events — Signal 3 validation
-- Tracks user journey: signup -> platform connected -> first render -> paid
-- Critical for measuring affiliate-sourced user activation

CREATE TABLE IF NOT EXISTS public.product_activation_events (
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
  referred_by_influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activation_user_event
  ON product_activation_events(user_id, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_event_time
  ON product_activation_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_referred
  ON product_activation_events(referred_by_influencer_id, event_name, occurred_at DESC)
  WHERE referred_by_influencer_id IS NOT NULL;

-- View: activation stats per affiliate (Signal 3)
CREATE OR REPLACE VIEW v_affiliate_activation_stats AS
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
