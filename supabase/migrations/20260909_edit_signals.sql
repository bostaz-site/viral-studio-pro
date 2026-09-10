ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS edit_signals JSONB DEFAULT NULL;
COMMENT ON COLUMN public.trending_clips.edit_signals IS 'Detected edit signals: {source_has_burned_captions, source_is_vertical, detected_at}. Both true = likely a re-post of someone else''s TikTok.';
