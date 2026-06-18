-- Strategic moves table — proposed by strategic agents (Strategist, AI Scout, Revenue)
CREATE TABLE IF NOT EXISTS public.strategic_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (agent_type IN ('strategist', 'ai_scout', 'revenue', 'spy', 'simplifier')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact INT NOT NULL CHECK (impact BETWEEN 1 AND 10),
  effort INT NOT NULL CHECK (effort BETWEEN 1 AND 10),
  confidence INT NOT NULL CHECK (confidence BETWEEN 1 AND 10),
  evidence TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('feature', 'optimization', 'integration', 'pivot')),
  proposed_week_of DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'shipped', 'in_progress', 'discarded', 'parked')),
  shipped_at TIMESTAMPTZ,
  outcome_metric TEXT,
  outcome_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategic_moves_status_week ON public.strategic_moves(status, proposed_week_of DESC);
CREATE INDEX idx_strategic_moves_agent ON public.strategic_moves(agent_type);

ALTER TABLE public.strategic_moves ENABLE ROW LEVEL SECURITY;

-- Admin-only access (owner + ops roles)
CREATE POLICY "Admin can manage strategic moves" ON public.strategic_moves
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'ops'))
  );
