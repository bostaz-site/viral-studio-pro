-- Enable RLS on all V3 tables (admin-only, accessed via service_role)
-- Applied during health check 2026-05-13

ALTER TABLE IF EXISTS public.compliance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_discovery_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.generated_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.public_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_video_performance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_assignment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.affiliate_signal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_scoring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_influencer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promoted_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scraper_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scraper_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scraper_source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scraper_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.high_intent_no_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.partner_sessions ENABLE ROW LEVEL SECURITY;
