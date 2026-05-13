-- Repost Kit: session + granular event tracking
-- Public pages (no auth), tracked via session_token cookie

CREATE TABLE IF NOT EXISTS public.repost_kit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  promo_video_id UUID,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  session_token TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  post_url TEXT,
  post_submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_repost_sessions_influencer
  ON repost_kit_sessions(influencer_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_repost_sessions_token
  ON repost_kit_sessions(session_token);

CREATE TABLE IF NOT EXISTS public.repost_kit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES repost_kit_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'kit_viewed', 'video_played', 'video_25_percent', 'video_50_percent',
    'video_75_percent', 'video_completed', 'download_hd_clicked',
    'download_mobile_clicked', 'caption_copied', 'code_copied',
    'hashtags_copied', 'platform_opened', 'post_url_submitted',
    'customization_requested', 'angle_changed', 'help_clicked'
  )),
  metadata JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repost_events_session
  ON repost_kit_events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_repost_events_type
  ON repost_kit_events(event_type, occurred_at DESC);

ALTER TABLE repost_kit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE repost_kit_events ENABLE ROW LEVEL SECURITY;
