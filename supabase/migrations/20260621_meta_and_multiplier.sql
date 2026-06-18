-- Meta-Agent reports (self-evaluation of audit agents)
CREATE TABLE IF NOT EXISTS public.meta_agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_evaluated TEXT NOT NULL,
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  performance_score INT NOT NULL CHECK (performance_score BETWEEN 0 AND 100),
  findings_actioned_rate NUMERIC,
  findings_ignored_rate NUMERIC,
  cost_per_actionable_finding NUMERIC,
  blind_spots JSONB,
  ignored_patterns JSONB,
  proposed_prompt_diff TEXT,
  proposed_prompt_full TEXT,
  confidence_in_proposal INT CHECK (confidence_in_proposal BETWEEN 0 AND 10),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'ab_testing', 'adopted', 'rejected')),
  adopted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Multiplier opportunities (AI uplift proposals for codebase)
CREATE TABLE IF NOT EXISTS public.ai_multiplier_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  component_description TEXT NOT NULL,
  current_implementation TEXT NOT NULL,
  proposed_ai_solution TEXT NOT NULL,
  ai_capability TEXT NOT NULL,
  predicted_lift_metric TEXT,
  predicted_lift_value NUMERIC,
  estimated_effort_hours NUMERIC,
  code_sketch TEXT,
  impact_score INT CHECK (impact_score BETWEEN 1 AND 10),
  confidence_score INT CHECK (confidence_score BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'in_progress', 'shipped', 'discarded')),
  shipped_at TIMESTAMPTZ,
  measured_lift NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_multiplier_priority
  ON public.ai_multiplier_opportunities(impact_score DESC, confidence_score DESC)
  WHERE status = 'proposed';

-- Agent prompt proposals (for meta-agent prompt refinement)
CREATE TABLE IF NOT EXISTS public.agent_prompt_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  previous_prompt TEXT NOT NULL,
  proposed_prompt TEXT NOT NULL,
  rationale TEXT NOT NULL,
  ab_test_results JSONB,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'ab_testing', 'adopted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: admin only
ALTER TABLE public.meta_agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_multiplier_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompt_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage meta agent" ON public.meta_agent_reports
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admin can manage ai multiplier" ON public.ai_multiplier_opportunities
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admin can manage prompt proposals" ON public.agent_prompt_proposals
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
