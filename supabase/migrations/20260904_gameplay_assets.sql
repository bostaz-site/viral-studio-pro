-- Gameplay assets for split-screen layout (bottom half)
CREATE TABLE IF NOT EXISTS public.gameplay_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'parkour',
  duration_s NUMERIC NOT NULL DEFAULT 60,
  license TEXT NOT NULL DEFAULT 'CC0',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gameplay_assets IS 'Looping gameplay clips (Minecraft parkour, runner, slime, etc.) used as bottom half of split-screen layout';
COMMENT ON COLUMN public.gameplay_assets.storage_path IS 'Path in Supabase Storage bucket "gameplay/"';
COMMENT ON COLUMN public.gameplay_assets.category IS 'parkour, runner, slime, sand, subway';
COMMENT ON COLUMN public.gameplay_assets.license IS 'License identifier (CC0, royalty-free, etc.)';

ALTER TABLE public.gameplay_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY gameplay_assets_read ON public.gameplay_assets FOR SELECT TO authenticated USING (true);
