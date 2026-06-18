-- Add lazy diff generation columns to audit_findings
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS proposed_diff TEXT,
  ADD COLUMN IF NOT EXISTS diff_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS diff_model TEXT,
  ADD COLUMN IF NOT EXISTS diff_estimated_lines_changed INT;

-- Add multi-file diff columns to root_cause_clusters
ALTER TABLE public.root_cause_clusters
  ADD COLUMN IF NOT EXISTS proposed_diff_multi_file JSONB,
  ADD COLUMN IF NOT EXISTS diff_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS diff_estimated_total_changes INT;
