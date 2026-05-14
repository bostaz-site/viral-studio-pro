-- V3-2B: AI Claude Scoring tables + influencer extensions

CREATE TABLE IF NOT EXISTS public.ai_scoring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('batch_score', 'reprocess', 'single')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  total_leads INT,
  processed_leads INT DEFAULT 0,
  failed_leads INT DEFAULT 0,
  cost_cents NUMERIC(10, 4) DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_scoring_jobs(status, created_at DESC);

-- Extend affiliate_signal_snapshots with AI scoring columns
ALTER TABLE public.affiliate_signal_snapshots
ADD COLUMN IF NOT EXISTS ai_job_id UUID REFERENCES ai_scoring_jobs(id),
ADD COLUMN IF NOT EXISTS claude_model TEXT,
ADD COLUMN IF NOT EXISTS prompt_version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS cost_cents NUMERIC(8, 4),
ADD COLUMN IF NOT EXISTS confidence NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS strengths JSONB,
ADD COLUMN IF NOT EXISTS concerns JSONB,
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT,
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- Extend influencers with AI affiliate score
ALTER TABLE public.influencers
ADD COLUMN IF NOT EXISTS ai_affiliate_score INT,
ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;

CREATE INDEX IF NOT EXISTS idx_influencers_ai_score
  ON influencers(ai_affiliate_score DESC NULLS LAST)
  WHERE ai_affiliate_score IS NOT NULL;
