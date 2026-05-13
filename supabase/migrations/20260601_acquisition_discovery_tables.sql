-- Acquisition V3: Discovery Layer tables

CREATE TABLE IF NOT EXISTS public.lead_discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('youtube_api', 'google_search', 'tiktok_hashtag', 'linktree_scrape', 'csv_import', 'manual')),
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  results_count INTEGER DEFAULT 0,
  new_leads_count INTEGER DEFAULT 0,
  duplicates_count INTEGER DEFAULT 0,
  suppressed_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  started_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_source_time ON lead_discovery_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_discovery_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES lead_discovery_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'twitter', 'twitch', 'kick', 'other')),
  platform_id TEXT,
  platform_handle TEXT,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  bio TEXT,
  audience_size INTEGER,
  engagement_rate NUMERIC(5,2),
  niche TEXT,
  language TEXT,
  country TEXT,
  recent_post_titles TEXT[],
  links TEXT[],
  keyword_score INTEGER DEFAULT 0,
  has_email BOOLEAN DEFAULT FALSE,
  email TEXT,
  email_source_url TEXT,
  promoted_products TEXT[],
  import_status TEXT DEFAULT 'pending' CHECK (import_status IN ('pending', 'imported', 'skipped', 'suppressed', 'duplicate')),
  skip_reason TEXT,
  influencer_id UUID REFERENCES influencers(id),
  raw_data JSONB,
  discovered_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (run_id, platform, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_discovery_results_run ON lead_discovery_results(run_id, keyword_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_results_platform ON lead_discovery_results(platform, platform_id);
CREATE INDEX IF NOT EXISTS idx_discovery_results_status ON lead_discovery_results(import_status, keyword_score DESC);
