-- Add auto-fix tracking columns to audit_findings
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS auto_fix_pr_url TEXT,
  ADD COLUMN IF NOT EXISTS auto_fix_status TEXT DEFAULT 'not_attempted'
    CHECK (auto_fix_status IN ('not_attempted', 'in_progress', 'pr_open', 'pr_merged', 'pr_closed_unfixed'));
