-- Table principale des findings
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_type TEXT NOT NULL, -- 'output' | 'acquisition' | 'activation' | 'retention' | 'technical'
  persona TEXT,             -- 'sceptical' | 'free_limit' | 'power' | null si pas un persona test
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'normal', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,            -- ex: 'app/page.tsx:42' ou 'landing-hero' ou 'upload-flow'
  suggested_fix TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'later', 'ignore', 'doing')),
  related_finding_id UUID REFERENCES public.audit_findings(id),
  cycle_count INT NOT NULL DEFAULT 1, -- nombre de cycles ou ce finding est apparu
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_findings_status ON public.audit_findings(status) WHERE status = 'open';
CREATE INDEX idx_audit_findings_severity ON public.audit_findings(severity);
CREATE INDEX idx_audit_findings_agent ON public.audit_findings(agent_type);
CREATE INDEX idx_audit_findings_date ON public.audit_findings(audit_date DESC);

-- Table snapshot des KPIs pour regression detection
CREATE TABLE IF NOT EXISTS public.audit_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_name TEXT NOT NULL, -- 'upload_success_rate' | 'render_success_rate' | 'signup_conversion' | etc.
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,          -- 'percentage' | 'count' | 'seconds' | 'mb'
  context JSONB,             -- details additionnels (ex: echantillon size, periode)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, metric_name)
);

CREATE INDEX idx_metrics_snapshots_metric ON public.audit_metrics_snapshots(metric_name, snapshot_date DESC);

-- RLS : admin only
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage audit findings" ON public.audit_findings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admin can manage audit metrics" ON public.audit_metrics_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('owner', 'admin')
    )
  );
