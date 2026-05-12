-- Migration 17: Convert influencers.email from TEXT to CITEXT
-- CITEXT handles case-insensitive uniqueness natively — no lower() index needed

-- Ensure extension exists (should already be from migration 3)
CREATE EXTENSION IF NOT EXISTS citext;

-- Convert influencers.email to CITEXT
ALTER TABLE influencers
  ALTER COLUMN email TYPE CITEXT USING email::CITEXT;

-- Drop the now-redundant lower(email) index
DROP INDEX IF EXISTS idx_influencers_email_lower;

-- The existing UNIQUE constraint on the CITEXT column is now case-insensitive
