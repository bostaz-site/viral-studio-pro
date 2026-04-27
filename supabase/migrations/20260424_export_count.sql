-- Add export_count to trending_clips (denormalized counter for social proof)
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS export_count INTEGER DEFAULT 0;

-- RPC to atomically increment the export count
CREATE OR REPLACE FUNCTION public.increment_export_count(p_clip_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.trending_clips
  SET export_count = COALESCE(export_count, 0) + 1
  WHERE id = p_clip_id;
$$;
