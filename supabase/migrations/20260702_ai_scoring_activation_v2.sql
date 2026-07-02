-- AI Scoring V2: activation-focused scoring columns
-- Adds missing AI columns to affiliate_signal_snapshots (batch-processor already references some)
-- Adds cadence columns to lead_discovery_results (scraper populates them)

-- 1. affiliate_signal_snapshots — existing AI columns the batch-processor already references but never existed
ALTER TABLE public.affiliate_signal_snapshots
  ADD COLUMN IF NOT EXISTS ai_job_id UUID,
  ADD COLUMN IF NOT EXISTS claude_model TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cost_cents NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS strengths JSONB,
  ADD COLUMN IF NOT EXISTS concerns JSONB,
  ADD COLUMN IF NOT EXISTS ai_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- 2. affiliate_signal_snapshots — new V2 activation scoring columns
ALTER TABLE public.affiliate_signal_snapshots
  ADD COLUMN IF NOT EXISTS ai_fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_activation_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_partner_intent_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_activation_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_main_concern TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommended_offer_angle TEXT;

-- 3. lead_discovery_results — cadence columns from scraper
ALTER TABLE public.lead_discovery_results
  ADD COLUMN IF NOT EXISTS recent_upload_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_upload_at TIMESTAMPTZ;

-- 4. Contactability score (deterministic, from scraper data)
ALTER TABLE public.lead_discovery_results
  ADD COLUMN IF NOT EXISTS contactability_score INTEGER;

COMMENT ON COLUMN public.affiliate_signal_snapshots.ai_activation_score IS 'How likely this creator is to POST affiliate content within 7 days (0-100)';
COMMENT ON COLUMN public.affiliate_signal_snapshots.ai_fit_score IS 'Audience fit for a clipping/creator tool (0-100)';
COMMENT ON COLUMN public.affiliate_signal_snapshots.ai_partner_intent_score IS 'Affiliate/sponsorship intent signals (0-100)';
COMMENT ON COLUMN public.affiliate_signal_snapshots.ai_risk_score IS 'Risk penalty: inactivity, copyright, kids content, too premium (0-100)';
COMMENT ON COLUMN public.affiliate_signal_snapshots.ai_recommended_offer_angle IS 'Best angle for the offer generator to use';
COMMENT ON COLUMN public.lead_discovery_results.recent_upload_count IS 'Videos uploaded in last 14 days (cadence signal)';
COMMENT ON COLUMN public.lead_discovery_results.last_upload_at IS 'Most recent video publish date';
COMMENT ON COLUMN public.lead_discovery_results.contactability_score IS 'Deterministic score 0-100 based on email presence, business contact, links';
