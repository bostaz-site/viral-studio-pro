-- PR Reviews table — stores AI reviews of recently merged PRs
CREATE TABLE IF NOT EXISTS public.pr_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number INT NOT NULL,
  pr_title TEXT NOT NULL,
  pr_url TEXT NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL,
  merged_by TEXT,
  files_changed INT,
  lines_added INT,
  lines_removed INT,
  review_summary TEXT,
  issues_found JSONB,
  patterns_detected JSONB,
  security_concerns JSONB,
  perf_concerns JSONB,
  overall_grade TEXT CHECK (overall_grade IN ('A', 'B', 'C', 'D', 'F')),
  follow_up_finding_ids UUID[],
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_reviews_merged_at ON public.pr_reviews(merged_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_reviews_pr_number ON public.pr_reviews(pr_number);

-- Enable RLS (admin-only table, service role bypasses)
ALTER TABLE public.pr_reviews ENABLE ROW LEVEL SECURITY;
