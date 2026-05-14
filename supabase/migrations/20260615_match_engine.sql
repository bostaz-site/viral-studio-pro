-- Match Engine: video-influencer scoring + assignment

CREATE TABLE IF NOT EXISTS public.video_influencer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
  match_score NUMERIC(5, 2) NOT NULL,
  match_breakdown JSONB,
  is_primary BOOLEAN DEFAULT FALSE,
  is_admin_override BOOLEAN DEFAULT FALSE,
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (influencer_id, promo_video_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_influencer ON video_influencer_matches(influencer_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_video ON video_influencer_matches(promo_video_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_primary ON video_influencer_matches(influencer_id) WHERE is_primary = TRUE;

CREATE TABLE IF NOT EXISTS public.video_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id),
  influencer_id UUID NOT NULL REFERENCES influencers(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  email_sent_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assignment_video_date ON video_assignment_log(promo_video_id, assigned_at DESC);

ALTER TABLE video_influencer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_assignment_log ENABLE ROW LEVEL SECURITY;
