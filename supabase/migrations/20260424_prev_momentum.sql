-- Add prev_momentum_score for decay indicator badges
ALTER TABLE public.trending_clips
  ADD COLUMN IF NOT EXISTS prev_momentum_score FLOAT;
