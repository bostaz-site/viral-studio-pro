-- Compliance V3-1C: Extend suppression_list for 4-way suppression
-- NOTE: Already applied via MCP — this file is for record-keeping

ALTER TABLE public.suppression_list
ADD COLUMN IF NOT EXISTS platform_handle TEXT,
ADD COLUMN IF NOT EXISTS profile_url TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT;

CREATE INDEX IF NOT EXISTS idx_suppression_handle ON suppression_list(lower(platform_handle), platform) WHERE platform_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppression_profile_url ON suppression_list(profile_url) WHERE profile_url IS NOT NULL;

-- 4-way suppression check function
CREATE OR REPLACE FUNCTION is_suppressed_4way(
  p_email TEXT,
  p_handle TEXT DEFAULT NULL,
  p_profile_url TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM suppression_list
    WHERE (
      (p_email IS NOT NULL AND lower(email) = lower(p_email)) OR
      (p_email IS NOT NULL AND email_domain = split_part(p_email, '@', 2)) OR
      (p_handle IS NOT NULL AND p_platform IS NOT NULL AND lower(platform_handle) = lower(p_handle) AND platform = p_platform) OR
      (p_profile_url IS NOT NULL AND profile_url = p_profile_url)
    )
    AND (expires_at IS NULL OR expires_at > now())
  );
$$ LANGUAGE SQL STABLE;
