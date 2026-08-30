-- Content risk filter: flag clips that TikTok restricts (gambling, violence, mature)
-- Prevents autofarm from auto-posting restricted content

ALTER TABLE public.trending_clips
  ADD COLUMN IF NOT EXISTS content_risk TEXT NULL;

COMMENT ON COLUMN public.trending_clips.content_risk IS 'gambling | violence | mature | NULL — TikTok content policy risk category';

CREATE INDEX IF NOT EXISTS idx_trending_clips_content_risk
  ON public.trending_clips (content_risk)
  WHERE content_risk IS NOT NULL;

-- Streamer-level risk: auto-learned from clip history
ALTER TABLE public.streamers
  ADD COLUMN IF NOT EXISTS content_risk TEXT NULL;

COMMENT ON COLUMN public.streamers.content_risk IS 'Inherited risk from clip history (>=60% flagged). gambling | violence | mature | NULL';

-- Distribution setting: allow risky content in autofarm (default OFF)
ALTER TABLE public.distribution_settings
  ADD COLUMN IF NOT EXISTS allow_risky_content BOOLEAN NOT NULL DEFAULT FALSE;
