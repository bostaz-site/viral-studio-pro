-- Scraper autopilot: saved queries table + influencers upload_cadence_days

CREATE TABLE IF NOT EXISTS public.scraper_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT 'creator_tools',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  results_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS upload_cadence_days NUMERIC DEFAULT NULL;

-- Seed 12 autopilot queries for affiliate discovery
-- insert into scraper_queries: 12 autopilot queries for affiliate discovery
INSERT INTO public.scraper_queries (query, niche) VALUES
  ('clipping tutorial twitch', 'clipping'),
  ('how to clip streams tiktok', 'clipping'),
  ('capcut gaming edit tutorial', 'editing'),
  ('tiktok growth strategy 2026', 'tiktok_growth'),
  ('youtube shorts automation', 'youtube_automation'),
  ('faceless gaming channel', 'gaming_commentary'),
  ('streamer tips grow twitch', 'streaming_tips'),
  ('kick streaming tips', 'streaming_tips'),
  ('opus clip review', 'creator_tools'),
  ('submagic review', 'creator_tools'),
  ('content creator tools 2026', 'creator_tools'),
  ('twitch clips compilation channel', 'clipping')
ON CONFLICT DO NOTHING;
