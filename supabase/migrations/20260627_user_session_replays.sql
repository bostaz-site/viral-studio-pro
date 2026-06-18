-- User Session Replays — stores analyzed real user sessions
-- Source: analytics_events table (privacy-first, no PII)
-- Populated weekly by scripts/audits/user-session-replay.ts

CREATE TABLE IF NOT EXISTS public.user_session_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_session_id TEXT NOT NULL,       -- hashed session_id from analytics_events
  session_outcome TEXT NOT NULL CHECK (session_outcome IN (
    'converted', 'signed_up_no_action', 'abandoned_at_step', 'bounced'
  )),
  abandoned_at_event TEXT,                 -- e.g. "cta_signup_click", "demo_cta_click"
  total_events INT NOT NULL DEFAULT 0,
  session_duration_seconds INT,
  events_sequence JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{event_name, relative_ts, page_path, metadata}]

  -- Claude analysis after replay
  friction_points JSONB,                   -- [{event, type: 'confusion'|'slowness'|'broken', evidence}]
  emotional_journey TEXT,                  -- narrative: "started curious -> confused at pricing -> left"
  comparison_to_personas JSONB,            -- where real user diverged from persona script

  finding_ids UUID[] DEFAULT '{}',
  replayed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_session_replays_outcome
  ON public.user_session_replays(session_outcome, replayed_at DESC);

CREATE INDEX idx_user_session_replays_date
  ON public.user_session_replays(replayed_at DESC);

-- RLS: admin only
ALTER TABLE public.user_session_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage session replays" ON public.user_session_replays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('owner', 'admin')
    )
  );

-- Service role bypass for script inserts
CREATE POLICY "Service role full access session replays" ON public.user_session_replays
  FOR ALL TO service_role USING (true) WITH CHECK (true);
