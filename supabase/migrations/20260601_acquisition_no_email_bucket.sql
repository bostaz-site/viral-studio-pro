-- Acquisition V3: High-intent leads without email (DM strategy bucket)

CREATE TABLE IF NOT EXISTS public.high_intent_no_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_result_id UUID REFERENCES lead_discovery_results(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_handle TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  audience_size INTEGER,
  keyword_score INTEGER DEFAULT 0,
  promoted_products TEXT[],
  reason TEXT,
  dm_attempted BOOLEAN DEFAULT FALSE,
  dm_attempted_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (platform, platform_handle)
);

CREATE INDEX IF NOT EXISTS idx_no_email_score ON high_intent_no_email(keyword_score DESC) WHERE dm_attempted = FALSE;
