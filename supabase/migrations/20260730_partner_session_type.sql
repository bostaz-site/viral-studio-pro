-- Add session_type column to distinguish magic links (15min, single-use) from sessions (30d).
-- Existing rows are all sessions (the old magic link WAS the session).
ALTER TABLE partner_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'session'
  CHECK (session_type IN ('magic_link', 'session'));
