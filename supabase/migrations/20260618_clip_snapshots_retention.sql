-- Retention policy for clip_snapshots
-- Keeps only 10 most recent snapshots per clip + auto-prune trigger

-- Index for efficient pruning (idempotent)
CREATE INDEX IF NOT EXISTS idx_clip_snapshots_clip_captured
  ON public.clip_snapshots(clip_id, captured_at DESC);

-- Delete old snapshots: keep only 10 most recent per clip
DELETE FROM public.clip_snapshots
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY clip_id ORDER BY captured_at DESC) AS rn
    FROM public.clip_snapshots
  ) ranked
  WHERE rn > 10
);

-- Auto-prune trigger for future inserts
CREATE OR REPLACE FUNCTION public.prune_clip_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.clip_snapshots
  WHERE clip_id = NEW.clip_id
    AND id NOT IN (
      SELECT id FROM public.clip_snapshots
      WHERE clip_id = NEW.clip_id
      ORDER BY captured_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clip_snapshots_prune_trigger ON public.clip_snapshots;

CREATE TRIGGER clip_snapshots_prune_trigger
AFTER INSERT ON public.clip_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.prune_clip_snapshots();
