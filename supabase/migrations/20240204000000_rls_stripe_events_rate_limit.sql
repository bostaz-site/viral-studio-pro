-- Enable RLS on stripe_events (service-role only — no client access)
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies = service_role can access but anon/authenticated cannot

-- Enable RLS on rate_limit_log (service-role only)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No policies = service_role can access but anon/authenticated cannot
