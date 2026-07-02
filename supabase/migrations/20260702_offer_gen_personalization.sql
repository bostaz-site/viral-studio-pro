-- Offer Generator real personalization columns

-- influencers: video titles for recent_topic, AI compliment for specific_compliment
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS recent_video_titles JSONB,
  ADD COLUMN IF NOT EXISTS ai_specific_compliment TEXT;

-- lead_discovery_results: video titles from scraper
ALTER TABLE public.lead_discovery_results
  ADD COLUMN IF NOT EXISTS recent_video_titles JSONB;

-- generated_offers: needs_review flag for low-personalization offers
ALTER TABLE public.generated_offers
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.influencers.recent_video_titles IS 'Array of recent video titles from scraper (for offer personalization)';
COMMENT ON COLUMN public.influencers.ai_specific_compliment IS 'Claude-generated specific compliment about their content (for offer emails)';
COMMENT ON COLUMN public.lead_discovery_results.recent_video_titles IS 'Array of recent video titles captured during scraper enrichment';
COMMENT ON COLUMN public.generated_offers.needs_review IS 'True when both specific_compliment and recent_topic are fallbacks (low personalization)';
