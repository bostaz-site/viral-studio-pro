CREATE TABLE IF NOT EXISTS public.improvement_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_ids UUID[] NOT NULL,            -- references audit_findings.id
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  predicted_impact_score INT NOT NULL,    -- 1-10
  predicted_effort_score INT NOT NULL,    -- 1-10
  category TEXT NOT NULL,                 -- 'ux', 'perf', 'copy', 'conversion', 'retention'
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'batched', 'shipped', 'discarded')),
  batched_in_week_of DATE,                -- monday of the week it was batched
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_improvement_backlog_status_impact ON public.improvement_backlog(status, predicted_impact_score DESC);

-- Admin RLS
ALTER TABLE public.improvement_backlog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage improvement backlog" ON public.improvement_backlog
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
