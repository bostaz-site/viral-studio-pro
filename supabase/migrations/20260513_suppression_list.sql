-- Migration 3: Suppression list with CITEXT for case-insensitive email matching
-- Global compliance layer — enforced BEFORE every campaign export

CREATE EXTENSION IF NOT EXISTS citext;

-- Drop old version if it exists (was TEXT, now CITEXT)
DROP TABLE IF EXISTS public.suppression_list CASCADE;

CREATE TABLE public.suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT,
  email_domain TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'unsubscribe', 'hard_bounce', 'soft_bounce_threshold',
    'complaint', 'manual_block', 'gdpr_request', 'fraud_flag'
  )),
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,

  CHECK (email IS NOT NULL OR email_domain IS NOT NULL)
);

-- CITEXT handles case-insensitive uniqueness natively — no lower() index needed
CREATE UNIQUE INDEX idx_suppression_email_unique
  ON suppression_list (email) WHERE email IS NOT NULL;
CREATE INDEX idx_suppression_domain ON suppression_list(email_domain) WHERE email_domain IS NOT NULL;
CREATE INDEX idx_suppression_reason ON suppression_list(reason, added_at DESC);

-- Check function: call before export
CREATE OR REPLACE FUNCTION is_suppressed(p_email TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM suppression_list
    WHERE (email = p_email::CITEXT
       OR email_domain = split_part(p_email, '@', 2))
      AND (expires_at IS NULL OR expires_at > now())
  );
$$ LANGUAGE SQL STABLE;

-- Stats function for admin dashboard
CREATE OR REPLACE FUNCTION get_suppression_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total', (SELECT count(*) FROM suppression_list),
    'this_week', (SELECT count(*) FROM suppression_list WHERE added_at > now() - interval '7 days'),
    'top_reasons', (
      SELECT coalesce(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT reason, count(*)::int as count
        FROM suppression_list
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 5
      ) r
    )
  );
$$ LANGUAGE SQL STABLE;
