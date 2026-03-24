-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Utilisateurs (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'studio')),
    monthly_videos_used INTEGER DEFAULT 0,
    monthly_processing_minutes_used INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos uploadees/importees
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    source_platform TEXT,
    storage_path TEXT NOT NULL,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    mime_type TEXT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'transcribing', 'analyzing', 'clipping', 'done', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcriptions
CREATE TABLE public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    language TEXT,
    full_text TEXT NOT NULL,
    segments JSONB NOT NULL,
    word_timestamps JSONB,
    speakers JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips generes
CREATE TABLE public.clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    start_time FLOAT NOT NULL,
    end_time FLOAT NOT NULL,
    duration_seconds FLOAT,
    storage_path TEXT,
    thumbnail_path TEXT,
    transcript_segment TEXT,
    caption_template TEXT DEFAULT 'default',
    aspect_ratio TEXT DEFAULT '9:16',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'done', 'error')),
    is_remake BOOLEAN DEFAULT FALSE,
    parent_clip_id UUID REFERENCES public.clips(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores viraux
CREATE TABLE public.viral_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID REFERENCES public.clips(id) ON DELETE CASCADE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    hook_strength INTEGER CHECK (hook_strength >= 0 AND hook_strength <= 100),
    emotional_flow INTEGER CHECK (emotional_flow >= 0 AND emotional_flow <= 100),
    perceived_value INTEGER CHECK (perceived_value >= 0 AND perceived_value <= 100),
    trend_alignment INTEGER CHECK (trend_alignment >= 0 AND trend_alignment <= 100),
    hook_type TEXT,
    explanation TEXT,
    suggested_hooks JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips trending (curation)
CREATE TABLE public.trending_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    author_name TEXT,
    author_handle TEXT,
    title TEXT,
    description TEXT,
    niche TEXT,
    view_count BIGINT,
    like_count BIGINT,
    velocity_score FLOAT,
    thumbnail_url TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comptes sociaux connectes (phase 2)
CREATE TABLE public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    username TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Publications (phase 2)
CREATE TABLE public.publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID REFERENCES public.clips(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES public.social_accounts(id),
    platform TEXT NOT NULL,
    platform_post_id TEXT,
    caption TEXT,
    hashtags TEXT[],
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'error')),
    tracking_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand templates
CREATE TABLE public.brand_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_path TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    font_family TEXT,
    intro_video_path TEXT,
    outro_video_path TEXT,
    watermark_path TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own videos" ON public.videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON public.videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON public.videos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transcriptions" ON public.transcriptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.videos WHERE videos.id = transcriptions.video_id AND videos.user_id = auth.uid())
);
CREATE POLICY "Users can insert own transcriptions" ON public.transcriptions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.videos WHERE videos.id = transcriptions.video_id AND videos.user_id = auth.uid())
);
CREATE POLICY "Users can update own transcriptions" ON public.transcriptions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.videos WHERE videos.id = transcriptions.video_id AND videos.user_id = auth.uid())
);
CREATE POLICY "Users can delete own transcriptions" ON public.transcriptions FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.videos WHERE videos.id = transcriptions.video_id AND videos.user_id = auth.uid())
);

CREATE POLICY "Users can view own clips" ON public.clips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clips" ON public.clips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clips" ON public.clips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clips" ON public.clips FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own viral scores" ON public.viral_scores FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = viral_scores.clip_id AND clips.user_id = auth.uid())
);
CREATE POLICY "Users can insert own viral scores" ON public.viral_scores FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = viral_scores.clip_id AND clips.user_id = auth.uid())
);
CREATE POLICY "Users can update own viral scores" ON public.viral_scores FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = viral_scores.clip_id AND clips.user_id = auth.uid())
);
CREATE POLICY "Users can delete own viral scores" ON public.viral_scores FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = viral_scores.clip_id AND clips.user_id = auth.uid())
);

CREATE POLICY "Anyone authenticated can view trending clips" ON public.trending_clips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only service role can manage trending clips" ON public.trending_clips FOR ALL USING (false);

CREATE POLICY "Users can view own social accounts" ON public.social_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own social accounts" ON public.social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own social accounts" ON public.social_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social accounts" ON public.social_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own publications" ON public.publications FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = publications.clip_id AND clips.user_id = auth.uid())
);
CREATE POLICY "Users can insert own publications" ON public.publications FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = publications.clip_id AND clips.user_id = auth.uid())
);
CREATE POLICY "Users can update own publications" ON public.publications FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = publications.clip_id AND clips.user_id = auth.uid())
);
CREATE POLICY "Users can delete own publications" ON public.publications FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.clips WHERE clips.id = publications.clip_id AND clips.user_id = auth.uid())
);

CREATE POLICY "Users can view own brand templates" ON public.brand_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brand templates" ON public.brand_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brand templates" ON public.brand_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brand templates" ON public.brand_templates FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- STORAGE BUCKETS
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('clips', 'clips', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Users can manage their own videos" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can manage their own clips" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can manage their own thumbnails" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can manage their own brand assets" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public read for clips" ON storage.objects FOR SELECT USING (bucket_id = 'clips');
CREATE POLICY "Public read for thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
