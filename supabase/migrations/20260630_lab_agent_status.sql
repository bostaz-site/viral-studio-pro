-- Lab Agent heartbeat tracking
CREATE TABLE IF NOT EXISTS public.lab_agent_status (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'paused', 'busy')),
  last_heartbeat_at TIMESTAMPTZ,
  current_dive_id UUID REFERENCES lab_deep_dives(id),
  hostname TEXT,
  version TEXT,
  total_executions INT DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO lab_agent_status (id, status) VALUES ('singleton', 'offline') ON CONFLICT DO NOTHING;

ALTER TABLE lab_agent_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage agent status" ON lab_agent_status
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Add pr_ready_failed to lab_deep_dives status constraint
ALTER TABLE public.lab_deep_dives
  DROP CONSTRAINT IF EXISTS lab_deep_dives_status_check;

ALTER TABLE public.lab_deep_dives
  ADD CONSTRAINT lab_deep_dives_status_check
  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'shipped', 'discarded', 'executing', 'pr_ready', 'pr_ready_failed'));
