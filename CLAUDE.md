# VIRAL STUDIO PRO — Instructions pour Claude Code

## Projet
Viral Studio Pro — Une webapp SaaS qui combine un outil de creation de clips viraux (clone OpusClip) + un moteur de curation de tendances virales + une distribution multi-plateforme.

## Stack Technique

### Frontend
- **Next.js 14** (App Router) avec TypeScript
- **Tailwind CSS** + **shadcn/ui** pour l'UI
- **Zustand** pour le state management
- **Supabase Auth** pour l'authentification
- Deploiement sur **Netlify** (pas Vercel)

### Backend / Services
- **Supabase** — PostgreSQL + Storage (videos/clips) + Auth + Realtime
- **n8n** — Orchestration des workflows (self-hosted ou cloud)
- **OpenAI Whisper API** — Transcription audio
- **Claude API (Anthropic)** — 4 skills IA (Hook Hunter, Retention Editor, Copywriter SEO, Credit Manager)
- **FFmpeg** — Montage video cote serveur (decoupe, sous-titres, reframe, split-screen)
- **yt-dlp** — Telechargement de videos depuis URL (YouTube, TikTok, etc.)
- **ElevenLabs API** — Voix-off text-to-speech (phase 2)
- **Stripe** — Paiements et abonnements (phase 2)

## Structure du Projet

```
viral-studio-pro/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Pages auth (login, signup)
│   ├── (dashboard)/              # Layout principal
│   │   ├── create/               # Section CREER (upload + clips)
│   │   ├── trending/             # Section TRENDING (curation)
│   │   ├── publish/              # Section PUBLIER (distribution)
│   │   └── settings/             # Parametres utilisateur
│   ├── api/                      # API Routes Next.js
│   │   ├── upload/               # Upload video
│   │   ├── clips/                # CRUD clips
│   │   ├── transcribe/           # Trigger Whisper
│   │   ├── analyze/              # Trigger Claude skills
│   │   ├── render/               # Trigger FFmpeg
│   │   └── webhooks/             # Webhooks n8n
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── video/                    # Player, Timeline, Preview
│   ├── clips/                    # ClipCard, ClipList, ViralScore
│   ├── captions/                 # CaptionEditor, Templates
│   ├── trending/                 # TrendingFeed, VelocityScore
│   └── publish/                  # SocialConnect, Scheduler
├── lib/
│   ├── supabase/                 # Client + server Supabase
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts              # Types generes depuis la DB
│   ├── ffmpeg/                   # Commandes FFmpeg
│   ├── whisper/                  # Client Whisper API
│   ├── claude/                   # Client Claude API + 4 skills
│   │   ├── hook-hunter.ts
│   │   ├── retention-editor.ts
│   │   ├── copywriter-seo.ts
│   │   └── credit-manager.ts
│   ├── ytdlp/                    # Wrapper yt-dlp
│   └── utils/                    # Helpers generaux
├── stores/                       # Zustand stores
│   ├── video-store.ts
│   ├── clips-store.ts
│   └── ui-store.ts
├── types/                        # Types TypeScript globaux
├── public/
├── supabase/
│   ├── migrations/               # Migrations SQL
│   └── seed.sql                  # Donnees de test
├── n8n/                          # Export des workflows n8n (JSON)
│   ├── the-hunter.json           # Workflow veille tendances
│   ├── the-maker.json            # Workflow creation clips
│   └── the-speaker.json          # Workflow distribution
├── scripts/                      # Scripts utilitaires
│   ├── ffmpeg-commands.sh        # Templates commandes FFmpeg
│   └── setup.sh                  # Script d'installation
├── .env.local                    # Variables d'environnement
├── CLAUDE.md                     # Ce fichier
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## Base de Donnees Supabase

### Tables principales

```sql
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
    source_url TEXT,                    -- URL YouTube/TikTok si importe
    source_platform TEXT,              -- 'upload', 'youtube', 'tiktok', 'instagram'
    storage_path TEXT NOT NULL,        -- Path dans Supabase Storage
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
    segments JSONB NOT NULL,           -- [{start, end, text, speaker?}]
    word_timestamps JSONB,             -- [{word, start, end}] pour karaoke
    speakers JSONB,                    -- [{id, name?, segments}] diarization
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips generes
CREATE TABLE public.clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    start_time FLOAT NOT NULL,         -- Debut dans la video source (secondes)
    end_time FLOAT NOT NULL,           -- Fin dans la video source (secondes)
    duration_seconds FLOAT,
    storage_path TEXT,                 -- Path du clip rendu dans Storage
    thumbnail_path TEXT,
    transcript_segment TEXT,           -- Texte du clip
    caption_template TEXT DEFAULT 'default',
    aspect_ratio TEXT DEFAULT '9:16',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'done', 'error')),
    is_remake BOOLEAN DEFAULT FALSE,
    parent_clip_id UUID REFERENCES public.clips(id),  -- Si c'est un remake
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
    hook_type TEXT,                     -- 'curiosity', 'shock', 'storytelling', 'transformation'
    explanation TEXT,                   -- Pourquoi ce score
    suggested_hooks JSONB,             -- [{hook_text, hook_type, score}]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips trending (curation)
CREATE TABLE public.trending_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,            -- 'tiktok', 'instagram', 'youtube'
    author_name TEXT,
    author_handle TEXT,
    title TEXT,
    description TEXT,
    niche TEXT,                        -- 'science', 'business', 'fitness', etc.
    view_count BIGINT,
    like_count BIGINT,
    velocity_score FLOAT,              -- Vitesse de croissance
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
    access_token TEXT,                 -- Encrypted
    refresh_token TEXT,                -- Encrypted
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
```

### Supabase Storage Buckets
```
videos/          -- Videos sources uploadees
clips/           -- Clips generes (rendus MP4)
thumbnails/      -- Thumbnails des clips
brand-assets/    -- Logos, intros, outros
```

### Row Level Security (RLS)
Toutes les tables ont RLS active. Chaque user ne peut voir/modifier que ses propres donnees, sauf `trending_clips` qui est lisible par tous les users authentifies.

## Variables d'Environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# APIs IA
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=

# n8n
N8N_BASE_URL=
N8N_API_KEY=

# Stripe (phase 2)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Conventions de Code

### Generales
- TypeScript strict partout (pas de `any`)
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Functions et variables en camelCase
- Utiliser les Server Components par defaut, Client Components seulement si interactivite necessaire
- Toujours gerer les erreurs avec try/catch et afficher un feedback utilisateur
- Pas de console.log en production

### API Routes
- Toujours valider les inputs (zod)
- Toujours verifier l'authentification
- Retourner des reponses JSON standardisees : `{ data, error, message }`

### Supabase
- Utiliser le client server-side dans les Server Components et API Routes
- Utiliser le client client-side dans les Client Components
- Typer toutes les queries avec les types generes

### UI/UX
- Interface sombre par defaut (dark mode)
- Design moderne, clean, inspire d'OpusClip mais avec notre identite
- Responsive mais desktop-first (les createurs travaillent sur desktop)
- Animations subtiles avec Framer Motion si necessaire
- Loading states et skeletons partout

## Les 4 Skills Claude — Prompts

### Hook Hunter
```
Tu es un expert en creation de hooks viraux pour les reseaux sociaux.
Analyse la transcription suivante et genere les 3 meilleurs hooks alternatifs.

Pour chaque hook :
1. Le texte du hook (max 15 mots)
2. Le type : curiosity / shock / storytelling / transformation
3. Score de potentiel viral (0-100)
4. Explication de pourquoi ca marche (2-3 phrases)

Reponds en JSON :
{
  "hooks": [
    {
      "text": "...",
      "type": "curiosity",
      "score": 85,
      "explanation": "..."
    }
  ]
}
```

### Retention Editor
```
Tu es un expert en retention de contenu video court.
Analyse la transcription avec timestamps et identifie les segments a garder pour maximiser la retention.

Regles :
- Clip final entre 15 et 90 secondes
- Garder les moments avec le plus de valeur/emotion
- Couper les pauses, repetitions, tangentes
- L'ordre peut etre reorganise si ca ameliore le flow

Reponds en JSON :
{
  "segments_to_keep": [
    {"start": 12.5, "end": 28.3, "reason": "Hook fort + revelation"},
    {"start": 45.1, "end": 67.8, "reason": "Point principal + emotion"}
  ],
  "suggested_order": [0, 1],
  "estimated_retention_score": 78
}
```

### Copywriter SEO
```
Tu es un copywriter expert en SEO pour les reseaux sociaux.
Genere une caption optimisee + hashtags pour le clip suivant.

Pour chaque plateforme (TikTok, Instagram, YouTube Shorts) :
1. Caption avec emojis et CTA
2. 15-30 hashtags tries par pertinence
3. Longueur adaptee a la plateforme

Reponds en JSON :
{
  "tiktok": {"caption": "...", "hashtags": ["..."]},
  "instagram": {"caption": "...", "hashtags": ["..."]},
  "youtube": {"caption": "...", "hashtags": ["..."]}
}
```

### Credit Manager
```
Tu es responsable d'attribuer les credits aux createurs originaux.
Genere un credit propre et professionnel pour le createur.

Reponds en JSON :
{
  "credit_line": "Inspiration : @username",
  "credit_description": "Credit : @username sur TikTok",
  "original_link": "https://..."
}
```

## Priorite de Developpement

L'ordre exact est :
1. **Sprint 1** — MVP : Upload → Transcription → AI Analysis → Clips → Download
2. **Sprint 2** — Captions karaoke + Timeline editor + Remake This
3. **Sprint 3** — Dashboard Trending + Veille automatique
4. **Sprint 4** — Branding + Paiement Stripe
5. **Sprint 5** — Distribution multi-plateforme

**Regle d'or : On ne passe au sprint suivant que quand le sprint actuel marche parfaitement.**

## Notes Importantes
- Le hosting frontend est sur **Netlify** (pas Vercel)
- Les workflows n8n sont exportes en JSON dans le dossier `n8n/`
- FFmpeg tourne sur un VPS separe (pas sur Netlify/Vercel)
- Les videos sont stockees dans Supabase Storage, pas en local
- Le watermark "Viral Studio Pro" est ajoute sur le plan gratuit, retire sur Pro/Studio
