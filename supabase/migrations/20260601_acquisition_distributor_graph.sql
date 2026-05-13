-- Acquisition V3: Distributor Graph (detect creators promoting competitor products)

CREATE TABLE IF NOT EXISTS public.promoted_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  discovery_result_id UUID REFERENCES lead_discovery_results(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_category TEXT,
  evidence_url TEXT,
  evidence_text TEXT,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (influencer_id, product_name)
);

CREATE INDEX IF NOT EXISTS idx_promoted_products_influencer ON promoted_products(influencer_id);
CREATE INDEX IF NOT EXISTS idx_promoted_products_product ON promoted_products(product_name);
