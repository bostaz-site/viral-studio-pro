-- Lab Deep Dives — main table for product decision deep dives
CREATE TABLE IF NOT EXISTS public.lab_deep_dives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_area TEXT NOT NULL,
  cycle_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'completed', 'failed', 'shipped', 'discarded'
  )),

  -- Phase 0: Intuition Snap
  intuition_solution TEXT,
  intuition_risk TEXT,
  intuition_metric TEXT,
  intuition_completed_at TIMESTAMPTZ,

  -- Phase 1: Context Gathering
  context_screenshots JSONB,
  context_code_paths JSONB,
  context_kg_nodes JSONB,
  context_founder_goals TEXT,
  context_completed_at TIMESTAMPTZ,

  -- Phase 2: Deep Research
  research_articles JSONB,
  research_competitors JSONB,
  research_reddit JSONB,
  research_synthesis TEXT,
  research_completed_at TIMESTAMPTZ,

  -- Phase 2.5: Metric Framing
  target_metric TEXT NOT NULL DEFAULT '',
  current_baseline NUMERIC,
  target_delta_minimum NUMERIC,
  measurement_method TEXT,
  metric_clarity_score INT CHECK (metric_clarity_score BETWEEN 1 AND 10),
  metric_completed_at TIMESTAMPTZ,

  -- Phase 3: Council (stored in lab_council_responses)
  council_completed_at TIMESTAMPTZ,

  -- Phase 4: Synthesis + Kill Switch
  final_recommendation TEXT,
  recommendation_rationale TEXT,
  kill_switch_scenario TEXT,
  kill_switch_severity INT CHECK (kill_switch_severity BETWEEN 1 AND 10),
  alternatives_rejected JSONB,
  confidence INT CHECK (confidence BETWEEN 1 AND 10),
  estimated_effort_hours NUMERIC,
  synthesis_completed_at TIMESTAMPTZ,

  -- Phase 5: Deliverable
  deliverable_markdown TEXT,
  claude_code_prompt TEXT,
  deliverable_completed_at TIMESTAMPTZ,

  -- Phase 6: Post-Ship Tracking (disabled pre-launch)
  shipped_at TIMESTAMPTZ,
  shipped_commit_sha TEXT,
  outcome_measured_at TIMESTAMPTZ,
  outcome_metric_before NUMERIC,
  outcome_metric_after NUMERIC,
  outcome_delta NUMERIC,
  outcome_prediction_accurate BOOLEAN,

  -- Metadata
  total_cost_usd NUMERIC,
  total_duration_seconds INT,
  user_action TEXT CHECK (user_action IN ('accepted', 'later', 'discarded')),
  user_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_deep_dives_status ON public.lab_deep_dives(status, created_at DESC);
CREATE INDEX idx_lab_deep_dives_feature ON public.lab_deep_dives(feature_area, cycle_number DESC);

ALTER TABLE public.lab_deep_dives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage lab deep dives" ON public.lab_deep_dives
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Council responses (1 per LLM per deep dive)
CREATE TABLE IF NOT EXISTS public.lab_council_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deep_dive_id UUID NOT NULL REFERENCES public.lab_deep_dives(id) ON DELETE CASCADE,
  llm_provider TEXT NOT NULL CHECK (llm_provider IN ('claude', 'openai', 'gemini')),
  llm_model TEXT NOT NULL,
  response_solution TEXT NOT NULL,
  response_rationale TEXT,
  response_concerns TEXT,
  response_raw JSONB,
  cost_usd NUMERIC,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_council_dive ON public.lab_council_responses(deep_dive_id);

ALTER TABLE public.lab_council_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage council responses" ON public.lab_council_responses
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Queue/cycle tracking
CREATE TABLE IF NOT EXISTS public.lab_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_area TEXT NOT NULL UNIQUE,
  current_cycle INT NOT NULL DEFAULT 1,
  last_dived_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  priority INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  forced_next BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lab_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage lab queue" ON public.lab_queue
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Seed initial queue
INSERT INTO public.lab_queue (feature_area, priority, next_scheduled_at) VALUES
  ('browse', 1, NOW()),
  ('enhance', 1, NOW() + INTERVAL '6 hours'),
  ('upload', 2, NOW() + INTERVAL '12 hours'),
  ('distribution', 2, NOW() + INTERVAL '18 hours'),
  ('analytics', 3, NOW() + INTERVAL '24 hours'),
  ('settings', 4, NOW() + INTERVAL '30 hours'),
  ('landing', 1, NOW() + INTERVAL '36 hours')
ON CONFLICT (feature_area) DO NOTHING;
