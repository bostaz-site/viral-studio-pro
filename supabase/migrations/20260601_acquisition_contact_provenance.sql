-- Acquisition V3: Contact Provenance (NO source = NO contact)

CREATE TABLE IF NOT EXISTS public.public_contact_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_result_id UUID REFERENCES lead_discovery_results(id) ON DELETE SET NULL,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'website', 'linktree', 'beacons', 'instagram', 'tiktok', 'youtube', 'twitter', 'other')),
  value TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_context TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.50,
  is_business_contact BOOLEAN DEFAULT FALSE,
  found_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (influencer_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_contact_points_influencer ON public_contact_points(influencer_id);
CREATE INDEX IF NOT EXISTS idx_contact_points_value ON public_contact_points(value) WHERE type = 'email';
