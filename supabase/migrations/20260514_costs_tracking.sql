-- Manual cost tracking for P&L
CREATE TABLE IF NOT EXISTS public.costs_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'infra', 'cold_email', 'tools', 'vas', 'legal',
    'banking', 'taxes', 'misc'
  )),
  vendor TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  billing_period_start DATE,
  billing_period_end DATE,
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_costs_period ON costs_manual(billing_period_start DESC);
CREATE INDEX IF NOT EXISTS idx_costs_category ON costs_manual(category, billing_period_start DESC);

ALTER TABLE costs_manual ENABLE ROW LEVEL SECURITY;
