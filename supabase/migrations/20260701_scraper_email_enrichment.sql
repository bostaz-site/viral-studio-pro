-- Add email_source and contactability_score to lead_discovery_results

ALTER TABLE public.lead_discovery_results
  ADD COLUMN IF NOT EXISTS email_source TEXT CHECK (
    email_source IS NULL OR email_source IN ('channel_description', 'video_description', 'linktree', 'external_site')
  ),
  ADD COLUMN IF NOT EXISTS contactability_score INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_discovery_results_contactability
  ON lead_discovery_results(contactability_score DESC)
  WHERE contactability_score > 0;
