-- Acquisition V3: Affiliate Signal Detection

CREATE TABLE IF NOT EXISTS public.affiliate_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  discovery_result_id UUID REFERENCES lead_discovery_results(id) ON DELETE SET NULL,
  keyword_score INTEGER DEFAULT 0,
  strong_signals TEXT[],
  medium_signals TEXT[],
  multi_monetization BOOLEAN DEFAULT FALSE,
  linktree_detected BOOLEAN DEFAULT FALSE,
  competitor_products TEXT[],
  raw_evidence JSONB,
  scored_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signal_snapshots_influencer ON affiliate_signal_snapshots(influencer_id, scored_at DESC);
