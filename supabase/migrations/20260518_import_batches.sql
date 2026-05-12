-- Migration 12: Import batches — CSV import tracking

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  source TEXT NOT NULL,
  file_name TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_skipped_suppression INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'processing' CHECK (status IN (
    'processing', 'completed', 'failed', 'partial'
  )),
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_time
  ON import_batches(imported_by, started_at DESC);

-- Link influencers to their import batch
ALTER TABLE public.influencers
ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id);

CREATE INDEX IF NOT EXISTS idx_influencers_import_batch ON influencers(import_batch_id);
