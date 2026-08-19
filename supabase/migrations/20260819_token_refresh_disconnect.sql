-- Track token refresh failures: mark accounts as disconnected so UI can prompt reconnect
ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disconnect_reason TEXT DEFAULT NULL;

-- Index for the cron that finds tokens expiring soon
CREATE INDEX IF NOT EXISTS idx_social_accounts_token_expiry
  ON public.social_accounts (token_expires_at)
  WHERE disconnected_at IS NULL;
