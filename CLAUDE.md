# VIRAL ANIMAL — Instructions pour Claude Code

## Projet
Viral Animal — Une webapp simple pour booster la viralite de clips de streamers. Tu choisis un clip (depuis la bibliotheque ou tu uploades le tien), tu l'ameliores (sous-titres, split-screen, tag streamer, gros moment au debut), et tu exportes.

## Le Flow Utilisateur

1. **Choisir un clip** — Bibliotheque de clips de streamers deja decoupes + upload de ton propre clip
2. **Booster la viralite** — Editeur avec : sous-titres karaoke, split-screen (gameplay en bas), tag du streamer, reordering (gros moment en premier → contexte apres)
3. **Exporter** — Telecharger la video finale optimisee en format vertical (9:16)

C'est tout. Pas plus complique.

## Stack Technique

### Frontend
- **Next.js 14** (App Router) avec TypeScript
- **Tailwind CSS** + **shadcn/ui** pour l'UI
- **Zustand** pour le state management
- **Supabase Auth** pour l'authentification
- Deploiement sur **Netlify** (pas Vercel)

### Backend / Services
- **Supabase** — PostgreSQL + Storage (clips) + Auth
- **FFmpeg** — Montage video (sous-titres karaoke, split-screen, reframe)
- **VPS Railway** — Serveur FFmpeg (bostaz-site-production.up.railway.app)
- **Twitch API** — Recuperer les clips de streamers populaires

## Structure du Projet

```
viral-studio-pro/
├── app/
│   ├── (auth)/                   # Pages auth (login, signup)
│   ├── (dashboard)/
│   │   ├── dashboard/            # Page principale — bibliotheque de clips
│   │   ├── dashboard/enhance/    # Editeur de viralite (sous-titres, split-screen, etc.)
│   │   └── settings/             # Parametres utilisateur
│   ├── api/
│   │   ├── upload/               # Upload de clip
│   │   ├── clips/                # CRUD clips
│   │   ├── render/               # Trigger FFmpeg (Railway VPS)
│   │   ├── export/               # Export video finale
│   │   ├── cron/fetch-twitch-clips/ # Fetch clips Twitch
│   │   └── streams/refresh/      # Refresh clips streamers
│   ├── layout.tsx
│   └── page.tsx                  # Landing page
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── video/                    # Player, Timeline, UploadZone
│   ├── clips/                    # ClipCard
│   ├── captions/                 # CaptionEditor, Templates
│   └── landing/                  # Landing page sections
├── lib/
│   ├── supabase/                 # Client + server Supabase
│   ├── ffmpeg/                   # Commandes FFmpeg (captions, split-screen, reframe)
│   ├── twitch/                   # Client Twitch API + fetch clips
│   └── utils.ts                  # Helpers generaux
├── stores/                       # Zustand stores
├── types/                        # Types TypeScript globaux
├── vps/                          # Serveur FFmpeg (deploye sur Railway)
│   ├── server.js
│   ├── routes/render.js
│   ├── lib/ffmpeg-render.js
│   └── lib/subtitle-generator.js
├── public/
├── .env.local
├── CLAUDE.md
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

## Base de Donnees Supabase

### Tables principales

```sql
-- Utilisateurs
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'studio')),
    stripe_customer_id TEXT,
    monthly_videos_used INTEGER DEFAULT 0,
    monthly_processing_minutes_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips (uploades par user ou depuis bibliotheque)
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
    error_message TEXT,
    is_remake BOOLEAN DEFAULT FALSE,
    parent_clip_id UUID REFERENCES public.clips(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips de streamers (bibliotheque)
CREATE TABLE public.trending_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,             -- 'twitch', 'youtube_gaming'
    author_name TEXT,
    author_handle TEXT,
    title TEXT,
    description TEXT,
    niche TEXT,                         -- 'irl', 'fps', 'moba', etc.
    view_count BIGINT,
    like_count BIGINT,
    duration_seconds FLOAT,
    velocity FLOAT,                     -- delta views / elapsed hours
    velocity_score FLOAT,               -- normalized 0-100
    viral_ratio FLOAT,                  -- velocity / (view_count + 1)
    viral_score FLOAT,                  -- composite score
    tier TEXT,                          -- 'trending', 'mega_viral'
    thumbnail_url TEXT,
    twitch_clip_id TEXT,
    clip_created_at TIMESTAMPTZ,
    streamer_id UUID REFERENCES public.streamers(id),
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos sources (uploads)
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    source_platform TEXT,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    error_message TEXT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'transcribing', 'analyzing', 'clipping', 'done', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streamers suivis (Twitch/Kick)
CREATE TABLE public.streamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    twitch_login TEXT,
    twitch_id TEXT,
    niche TEXT,
    priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Render jobs (suivi des rendus FFmpeg)
CREATE TABLE public.render_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id TEXT NOT NULL,
    source TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending',
    storage_path TEXT,
    clip_url TEXT,
    error_message TEXT,
    debug_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcriptions (Whisper word-level)
CREATE TABLE public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id),
    full_text TEXT NOT NULL,
    language TEXT,
    segments JSONB,
    speakers JSONB,
    word_timestamps JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshots de vues (calcul velocity)
CREATE TABLE public.clip_snapshots (
    id SERIAL PRIMARY KEY,
    clip_id UUID REFERENCES public.trending_clips(id),
    view_count BIGINT NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Supabase Storage Buckets
```
videos/          -- Videos/clips sources
clips/           -- Clips rendus (MP4 final)
thumbnails/      -- Thumbnails
brand-assets/    -- Logos, watermarks utilisateur
```

## Variables d'Environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# VPS Render (Railway)
VPS_RENDER_URL=https://bostaz-site-production.up.railway.app
VPS_RENDER_API_KEY=

# Twitch
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://viralanimal.com
```

## Conventions de Code

### Generales
- TypeScript strict partout (pas de `any`)
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Functions et variables en camelCase
- Server Components par defaut, Client Components seulement si interactivite
- Toujours gerer les erreurs avec try/catch
- Pas de console.log en production

### API Routes
- Valider les inputs (zod)
- Verifier l'authentification
- Reponses JSON : `{ data, error, message }`

### UI/UX
- Interface sombre (dark mode)
- Design moderne, clean
- Desktop-first
- Loading states et skeletons partout

## Notes Importantes
- Frontend sur **Netlify** (pas Vercel)
- FFmpeg tourne sur **Railway** (pas sur Netlify)
- Videos stockees dans **Supabase Storage**, pas en local
- Pas de n8n, pas de Claude API skills, pas de Whisper, pas de distribution multi-plateforme
- Le projet est SIMPLE : clips streamers → boost viralite → export
