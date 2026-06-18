CREATE TABLE IF NOT EXISTS public.root_cause_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name TEXT NOT NULL,
  root_cause_description TEXT NOT NULL,
  impact_summary TEXT NOT NULL,             -- "Fixing this resolves 42 findings"
  finding_ids UUID[] NOT NULL,              -- references audit_findings.id
  findings_count INT NOT NULL,
  total_severity_score NUMERIC,             -- sum of severity weights
  estimated_effort_hours NUMERIC,           -- to fix the root cause
  estimated_impact INT CHECK (estimated_impact BETWEEN 1 AND 10),
  confidence_score INT CHECK (confidence_score BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'in_progress', 'fixed', 'discarded')),
  fix_pr_url TEXT,
  fixed_at TIMESTAMPTZ,
  measured_outcome JSONB,                   -- what improved after fix
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_root_cause_clusters_impact ON public.root_cause_clusters(estimated_impact DESC, findings_count DESC) WHERE status = 'identified';

-- Admin RLS
ALTER TABLE public.root_cause_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage root cause clusters" ON public.root_cause_clusters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Add cluster reference to findings
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS root_cause_cluster_id UUID REFERENCES public.root_cause_clusters(id);

CREATE INDEX IF NOT EXISTS idx_audit_findings_cluster ON public.audit_findings(root_cause_cluster_id) WHERE root_cause_cluster_id IS NOT NULL;
