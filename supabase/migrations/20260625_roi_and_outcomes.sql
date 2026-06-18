-- ROI prediction columns on audit_findings
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS predicted_impact_revenue NUMERIC,
  ADD COLUMN IF NOT EXISTS predicted_impact_conversion NUMERIC,
  ADD COLUMN IF NOT EXISTS predicted_impact_ux INT CHECK (predicted_impact_ux BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS predicted_effort_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS predicted_confidence INT CHECK (predicted_confidence BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS roi_score NUMERIC GENERATED ALWAYS AS (
    (COALESCE(predicted_impact_revenue, 0) +
     COALESCE(predicted_impact_conversion, 0) * 100 +
     COALESCE(predicted_impact_ux, 0) * 50)
    * COALESCE(predicted_confidence, 5) / 10.0
    / GREATEST(COALESCE(predicted_effort_hours, 1), 1)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_audit_findings_roi
  ON public.audit_findings(roi_score DESC NULLS LAST)
  WHERE status = 'open';

-- ROI columns on root_cause_clusters
ALTER TABLE public.root_cause_clusters
  ADD COLUMN IF NOT EXISTS predicted_impact_revenue NUMERIC,
  ADD COLUMN IF NOT EXISTS predicted_impact_conversion NUMERIC,
  ADD COLUMN IF NOT EXISTS predicted_impact_ux INT,
  ADD COLUMN IF NOT EXISTS predicted_confidence INT;

-- Outcome measurements table
CREATE TABLE IF NOT EXISTS public.outcome_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID REFERENCES public.audit_findings(id),
  cluster_id UUID REFERENCES public.root_cause_clusters(id),
  fix_pr_url TEXT,
  fix_merged_at TIMESTAMPTZ NOT NULL,
  measurement_window_days INT NOT NULL DEFAULT 7,

  -- Predicted (saved at fix time)
  predicted_impact_revenue NUMERIC,
  predicted_impact_conversion NUMERIC,
  predicted_impact_ux INT,

  -- Actual (measured after window)
  actual_metric_before NUMERIC,
  actual_metric_after NUMERIC,
  actual_lift_percent NUMERIC,
  actual_revenue_delta NUMERIC,

  -- Verdict
  did_it_work BOOLEAN,
  confidence_in_attribution INT CHECK (confidence_in_attribution BETWEEN 1 AND 10),
  notes TEXT,

  measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcome_measurements_finding
  ON public.outcome_measurements(finding_id);
CREATE INDEX IF NOT EXISTS idx_outcome_measurements_verdict
  ON public.outcome_measurements(did_it_work, fix_merged_at DESC);

-- RLS
ALTER TABLE public.outcome_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage outcome measurements" ON public.outcome_measurements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
