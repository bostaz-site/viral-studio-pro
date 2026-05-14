-- V3-2A: Promo video library tables

CREATE TABLE IF NOT EXISTS public.promo_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Video storage
  storage_path TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'promo-videos',
  thumbnail_path TEXT,

  -- Metadata (extracted via ffprobe)
  duration_seconds NUMERIC(6, 2),
  width INT,
  height INT,
  aspect_ratio TEXT,
  codec TEXT,
  file_size_bytes BIGINT,

  -- Tags (for match engine)
  niche TEXT[] DEFAULT '{}',
  hook_type TEXT CHECK (hook_type IN (
    'curiosity', 'shock', 'transformation', 'social_proof',
    'storytelling', 'tutorial', 'comparison', 'testimonial'
  )),
  tone TEXT CHECK (tone IN ('casual', 'professional', 'funny', 'inspirational', 'edgy')),
  language TEXT DEFAULT 'en',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  replaces_video_id UUID REFERENCES promo_videos(id),

  -- Performance aggregates (denormalized)
  total_kits_generated INT DEFAULT 0,
  total_views INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  total_signups INT DEFAULT 0,
  avg_engagement_rate NUMERIC(5, 2),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_videos_status ON promo_videos(status);
CREATE INDEX IF NOT EXISTS idx_promo_videos_niche ON promo_videos USING GIN(niche);
CREATE INDEX IF NOT EXISTS idx_promo_videos_hook ON promo_videos(hook_type);
CREATE INDEX IF NOT EXISTS idx_promo_videos_performance ON promo_videos(total_signups DESC) WHERE status = 'active';

-- Assets (HD, mobile, thumbnail, etc.)
CREATE TABLE IF NOT EXISTS public.promo_video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('hd', 'mobile', 'square', 'gif_preview', 'thumbnail')),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_assets_video ON promo_video_assets(promo_video_id);

-- Daily performance tracking
CREATE TABLE IF NOT EXISTS public.promo_video_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  kits_generated INT DEFAULT 0,
  kit_views INT DEFAULT 0,
  video_completions INT DEFAULT 0,
  code_copies INT DEFAULT 0,
  posts_submitted INT DEFAULT 0,
  signups_attributed INT DEFAULT 0,
  revenue_cents NUMERIC(12, 2) DEFAULT 0,
  UNIQUE (promo_video_id, date)
);

CREATE INDEX IF NOT EXISTS idx_promo_perf_date ON promo_video_performance_daily(date DESC, promo_video_id);

-- Auto-update updated_at
DO $$ BEGIN
  CREATE TRIGGER tr_promo_videos_updated_at BEFORE UPDATE ON promo_videos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
