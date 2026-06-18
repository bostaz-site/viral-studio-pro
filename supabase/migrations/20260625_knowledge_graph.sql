-- Knowledge Graph nodes
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL CHECK (node_type IN ('feature','business_goal','tool','person','state','codebase_area','metric','platform')),
  name TEXT NOT NULL,
  description TEXT,
  importance_score INT CHECK (importance_score BETWEEN 1 AND 10),
  is_protected BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  related_finding_ids UUID[],
  related_cluster_ids UUID[],
  source_count INT DEFAULT 1,
  last_referenced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(node_type, name)
);

-- Knowledge Graph edges
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('affects','depends_on','blocks','monetizes','measured_by','tested_by','implemented_in','protected_by','risks','similar_to')),
  strength NUMERIC CHECK (strength BETWEEN 0 AND 1),
  provenance TEXT,
  evidence_count INT DEFAULT 1,
  is_protected BOOLEAN DEFAULT FALSE,
  last_confirmed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_node_id, target_node_id, relationship)
);

CREATE INDEX idx_knowledge_edges_source ON public.knowledge_edges(source_node_id, relationship);
CREATE INDEX idx_knowledge_edges_target ON public.knowledge_edges(target_node_id, relationship);

-- Founder profile
CREATE TABLE IF NOT EXISTS public.founder_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL CHECK (insight_type IN ('preference','pattern','risk','strength','anti_pattern')),
  insight_text TEXT NOT NULL,
  confidence INT CHECK (confidence BETWEEN 1 AND 10),
  supporting_data JSONB,
  derived_from TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS admin only
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage nodes" ON public.knowledge_nodes FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Admin manage edges" ON public.knowledge_edges FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Admin manage founder profile" ON public.founder_profile FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
