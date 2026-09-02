-- Platform-specific render variants for cross-platform deduplication.
-- Each variant is a lightweight re-encode of the base render with unique
-- diversification (audio shift, color grade, crop, grain, etc.).
CREATE TABLE IF NOT EXISTS public.render_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_job_id UUID NOT NULL REFERENCES public.render_jobs(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_id TEXT,
  storage_path TEXT NOT NULL,
  seed BIGINT NOT NULL,
  diversify_params JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_render_variants_job ON public.render_variants(render_job_id);
CREATE INDEX IF NOT EXISTS idx_render_variants_platform ON public.render_variants(platform, render_job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_render_variants_unique ON public.render_variants(render_job_id, variant_key);

ALTER TABLE public.render_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own variants" ON public.render_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.render_jobs rj
      WHERE rj.id = render_variants.render_job_id
      AND rj.user_id = auth.uid()
    )
  );
