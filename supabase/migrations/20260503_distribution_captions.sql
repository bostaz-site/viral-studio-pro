-- Distribution AI Captions
-- Stores generated caption variants per clip/user/platforms combo.

CREATE TABLE IF NOT EXISTS public.distribution_captions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    platforms TEXT[] NOT NULL,
    variants JSONB NOT NULL,
    model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_distribution_captions_clip_user ON public.distribution_captions (clip_id, user_id);
CREATE INDEX idx_distribution_captions_user_date ON public.distribution_captions (user_id, created_at DESC);

-- RLS
ALTER TABLE public.distribution_captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own captions"
    ON public.distribution_captions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own captions"
    ON public.distribution_captions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
