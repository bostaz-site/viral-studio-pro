# VIRAL STUDIO PRO — Instructions pour Claude Code

## Projet
Viral Studio Pro — Une webapp simple pour booster la viralite de clips de streamers. Tu choisis un clip (depuis la bibliotheque ou tu uploades le tien), tu l'ameliores (sous-titres, split-screen, tag streamer, gros moment au debut), et tu exportes.

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
    monthly_videos_used INTEGER DEFAULT 0,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips de streamers (bibliotheque)
CREATE TABLE public.trending_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,             -- 'twitch', 'youtube'
    author_name TEXT,
    author_handle TEXT,
    title TEXT,
    description TEXT,
    game TEXT,                          -- 'Fortnite', 'Valorant', 'LoL', etc.
    view_count BIGINT,
    like_count BIGINT,
    thumbnail_url TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos sources (uploads)
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_url TEXT,
    source_platform TEXT,
    storage_path TEXT NOT NULL,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'done', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Supabase Storage Buckets
```
videos/          -- Videos/clips sources
clips/           -- Clips rendus (MP4 final)
thumbnails/      -- Thumbnails
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
NEXT_PUBLIC_APP_URL=https://viral-studio-pro.netlify.app
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
