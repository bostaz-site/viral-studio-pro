-- Acquisition V3: Scraper metadata tables

CREATE TABLE IF NOT EXISTS public.scraper_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  total_results INTEGER DEFAULT 0,
  quality_metrics JSONB,
  source_status TEXT DEFAULT 'active' CHECK (source_status IN ('active', 'cooling_down', 'paused', 'killed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scraper_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  units_used INTEGER DEFAULT 0,
  units_limit INTEGER DEFAULT 10000,
  calls_made INTEGER DEFAULT 0,
  UNIQUE (source, date)
);

CREATE TABLE IF NOT EXISTS public.scraper_source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  last_check_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'down', 'rate_limited')),
  error_rate NUMERIC(5,2) DEFAULT 0,
  avg_response_ms INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.scraper_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  last_call_at TIMESTAMPTZ DEFAULT now(),
  calls_in_window INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT now(),
  window_seconds INTEGER DEFAULT 60,
  max_calls_per_window INTEGER DEFAULT 100,
  UNIQUE (source, endpoint)
);
