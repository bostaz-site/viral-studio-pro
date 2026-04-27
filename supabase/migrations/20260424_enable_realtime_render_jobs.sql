-- Enable Supabase Realtime for render_jobs table
-- Used by useRenderSubscription hook for instant status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.render_jobs;
