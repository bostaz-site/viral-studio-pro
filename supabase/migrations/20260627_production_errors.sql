-- Production errors table — stores normalized errors from Sentry/Netlify/Railway
CREATE TABLE IF NOT EXISTS public.production_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('sentry', 'netlify_functions', 'railway_logs', 'browser_console')),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  affected_file TEXT,
  affected_line INT,
  occurrence_count INT NOT NULL DEFAULT 1,
  affected_users_count INT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  cluster_signature TEXT,
  root_cause_cluster_id UUID REFERENCES public.root_cause_clusters(id),
  finding_id UUID REFERENCES public.audit_findings(id),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigated', 'fixed', 'ignored', 'expected')),
  sentry_issue_id TEXT,
  sentry_url TEXT,
  ai_root_cause TEXT,
  ai_suggested_fix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_errors_signature ON public.production_errors(cluster_signature);
CREATE INDEX idx_production_errors_last_seen ON public.production_errors(last_seen_at DESC) WHERE status = 'new';
CREATE INDEX idx_production_errors_source ON public.production_errors(source);

-- Admin RLS
ALTER TABLE public.production_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage production errors" ON public.production_errors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
