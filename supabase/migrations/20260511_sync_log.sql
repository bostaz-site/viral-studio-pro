-- Lightweight key-value table to track integration sync status.
-- Used by the Instantly sync service to persist last sync time, result, etc.

CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT UNIQUE NOT NULL,      -- e.g. 'instantly_sync'
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Only admin/service_role should read/write sync_log
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
