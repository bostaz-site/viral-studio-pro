-- Migration 14: Lead enrichment snapshots — Apify/Apollo/Clearbit data

CREATE TABLE IF NOT EXISTS public.lead_enrichment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apify', 'apollo', 'clearbit', 'manual')),
  raw_data JSONB NOT NULL,
  audience_size INTEGER,
  engagement_rate NUMERIC(5, 2),
  niche_detected TEXT,
  recent_posts_count INTEGER,
  last_post_at TIMESTAMPTZ,
  cost_cents NUMERIC(8, 4),
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enrichment_influencer_time
  ON lead_enrichment_snapshots(influencer_id, fetched_at DESC);
