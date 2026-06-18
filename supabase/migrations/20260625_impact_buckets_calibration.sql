-- Replace precise MRR predictions with categorical impact buckets
-- Philosophy: honesty > false precision

-- Drop dependent generated column first
ALTER TABLE public.audit_findings DROP COLUMN IF EXISTS roi_score;

-- Remove numeric prediction columns
ALTER TABLE public.audit_findings
  DROP COLUMN IF EXISTS predicted_impact_revenue,
  DROP COLUMN IF EXISTS predicted_impact_conversion;

-- Add bucket-based impact assessment
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS predicted_impact_bucket TEXT DEFAULT 'unknown'
    CHECK (predicted_impact_bucket IN ('critical', 'high', 'medium', 'low', 'unknown')),
  ADD COLUMN IF NOT EXISTS predicted_impact_reasoning TEXT;

-- Recreate roi_score as bucket-based formula
-- roi_score = bucket_weight * confidence / effort
ALTER TABLE public.audit_findings
  ADD COLUMN roi_score NUMERIC GENERATED ALWAYS AS (
    (CASE predicted_impact_bucket
      WHEN 'critical' THEN 100
      WHEN 'high' THEN 50
      WHEN 'medium' THEN 20
      WHEN 'low' THEN 5
      ELSE 10
    END)
    * COALESCE(predicted_confidence, 5) / 10.0
    / GREATEST(COALESCE(predicted_effort_hours, 1), 1)
  ) STORED;

-- Same for root_cause_clusters
ALTER TABLE public.root_cause_clusters
  ADD COLUMN IF NOT EXISTS predicted_impact_bucket TEXT DEFAULT 'unknown'
    CHECK (predicted_impact_bucket IN ('critical', 'high', 'medium', 'low', 'unknown')),
  ADD COLUMN IF NOT EXISTS predicted_impact_reasoning TEXT;
