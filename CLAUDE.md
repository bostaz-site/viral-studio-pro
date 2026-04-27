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
│   │   ├── account/sync/         # Creator Rank — sync YouTube stats + score
│   │   ├── social-accounts/      # GET connected accounts
│   │   ├── cron/fetch-twitch-clips/ # Fetch clips Twitch
│   │   ├── cron/rescore-clips/   # Cron stratifie — re-scoring dynamique V2
│   │   ├── cron/cleanup-render-jobs/ # Cleanup zombie render jobs
│   │   ├── cron/reconcile-render/ # Reconcile Redis active jobs Set with DB
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
│   ├── scoring/                  # Scoring V2 engine (clip-scorer.ts, account-scorer.ts)
│   ├── ai/                       # Mood detector + presets (Claude Haiku)
│   ├── twitch/                   # Client Twitch API + fetch clips
│   ├── kick/                     # Client Kick API + fetch clips
│   ├── schemas/                  # Shared Zod schemas (render.ts)
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

**RLS (Row Level Security)** est active sur toutes les tables utilisateur. Chaque user ne peut lire/ecrire que ses propres donnees. `trending_clips` et `streamers` sont en lecture publique. Les operations admin/cron utilisent le service role qui bypass le RLS. Migration : `20260425_rls_policies.sql`.

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

-- Codes affilies (programme referral self-service)
CREATE TABLE public.affiliate_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    code TEXT NOT NULL UNIQUE,
    custom_handle TEXT UNIQUE,
    clicks INTEGER DEFAULT 0,
    signups INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    total_earned NUMERIC(10,2) DEFAULT 0,
    commission_rate NUMERIC(3,2) DEFAULT 0.20,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evenements de referral
CREATE TABLE public.referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_code_id UUID REFERENCES public.affiliate_codes(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('click', 'signup', 'conversion', 'payout')),
    referred_user_id UUID REFERENCES public.profiles(id),
    amount NUMERIC(10,2),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
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

# Upstash Redis (rate limiting + distributed locks)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Render queue (optional, default 3)
# To scale: increase this value. Railway supports horizontal scaling —
# 2 instances with MAX_CONCURRENT=3 each gives 6 total slots.
RENDER_MAX_CONCURRENT=3

# Webhook security (optional, set true once VPS sends HMAC signatures)
WEBHOOK_HMAC_ONLY=false

# Admin (server-only, never NEXT_PUBLIC_)
ADMIN_EMAILS=samycloutier30@gmail.com

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

## Systeme de Scoring V2 (Browse / Trending Clips)

Fichier principal : `lib/scoring/clip-scorer.ts`
Utilise par : `lib/twitch/fetch-streamer-clips.ts`, `lib/kick/fetch-kick-clips.ts`

### 7 Facteurs

| # | Facteur | Poids | Ce qu'il mesure |
|---|---------|-------|-----------------|
| 1 | **Momentum Dynamique** | 25% | Vitesse actuelle + acceleration (si 2+ snapshots) ou estimation sublineaire (age^0.7) |
| 2 | **Platform Authority** | 20% | Performance du clip vs moyenne du streamer, ponderee par le volume de vues |
| 3 | **Engagement Proxy** | 15% | Ratio likes/vues + signaux titre (caps, ponctuation) |
| 4 | **Recency Decay** | 10% | Decroissance exponentielle e^(-age/24) — jamais 0 |
| 5 | **Early Signal** | 10% | Detection precoce (<6h) : vues/min × log(vues) × decay rapide |
| 6 | **Format Score** | 10% | Duree optimale TikTok/Reels : 15-45s = 100, >60s = 50 |
| 7 | **Saturation Penalty** | -10% | Penalise les vieux clips viraux (>7j + >1M vues) et les clips morts |

### Formule finale
```
final_score = momentum×0.25 + authority×0.20 + engagement×0.15 + recency×0.10
            + earlySignal×0.10 + format×0.10 - saturation×0.10
```

### Tiers
- **mega_viral** : score >= 90
- **viral** : score >= 75
- **hot** : score >= 60
- **rising** : score >= 40
- **normal** : score >= 15
- **dead** : score < 15

### Categories Feed
- **early_gem** : clip < 6h avec signal precoce fort OU autorite elevee
- **hot_now** : momentum >= 65 ET clip < 12h
- **proven** : score >= 55 ET clip > 12h
- **normal** : tout le reste

### Colonnes DB (trending_clips)
- `velocity_score` : score final V2 (0-100)
- `anomaly_score` : authority_score (reutilise la colonne existante)
- `tier` : classification tier
- `feed_category` : categorie feed
- `momentum_score`, `engagement_score`, `recency_score`, `early_signal_score`, `format_score`, `saturation_score` : scores par facteur

### Spike Detection
Si la velocity du clip depasse 2× la moyenne du streamer → boost momentum ×1.5

## Cron Stratifie (Re-scoring dynamique)

Route : `app/api/cron/rescore-clips/route.ts`
Declencheur : Netlify Scheduled Function (toutes les 5 min)

### Principe
Les clips ne sont pas tous re-scores a la meme frequence. Plus un clip est recent, plus il est re-score souvent :

| Age du clip | Frequence re-score |
|-------------|-------------------|
| < 6h | Toutes les 15 min |
| 6-24h | Toutes les heures |
| > 24h | 1 fois par jour |

### Colonne next_check_at
Chaque clip a une colonne `next_check_at` (TIMESTAMPTZ) dans `trending_clips`. Le cron selectionne les clips ou `next_check_at <= NOW()`, les re-score, et met a jour `next_check_at` selon leur age.

### Spike Trigger
Si un snapshot montre +20% de vues vs le snapshot precedent → le clip est re-score immediatement (next_check_at = NOW).

### Pipeline
1. Cron tourne toutes les 5 min
2. Selectionne clips ou next_check_at <= NOW (batch de 50)
3. Pour chaque clip : recalcule scoreClip() avec les donnees actuelles
4. Met a jour velocity_score, tier, feed_category, tous les sous-scores
5. Calcule le prochain next_check_at selon l'age du clip

## Systeme de Ranking Createur

Fichier principal : `lib/scoring/account-scorer.ts`
Route API : `app/api/account/sync/route.ts`
Store : `stores/account-store.ts`
UI : `components/settings/creator-rank-section.tsx`
Migration : `supabase/migrations/20260422_creator_ranking.sql`

### 5 Facteurs

| # | Facteur | Poids | Ce qu'il mesure |
|---|---------|-------|-----------------|
| 1 | **Performance** | 30% | Median views / followers (ajuste par shorts_ratio). Ratio cap a 3.0. shorts_ratio > 0.8 → seuils plus exigeants (×33 vs ×67). 0 followers → score neutre 20. |
| 2 | **Engagement** | 20% | Median (likes+comments)/views des 20 dernieres videos. Seuils ajustes par format : shorts > 0.8 → excellent = 8%, sinon excellent = 5%. |
| 3 | **Growth** | 20% | Croissance followers 30 jours (log scale) : log(1 + growth_percent) × 20. null → 0, negatif → score bas. |
| 4 | **Audience** | 15% | Taille absolue en log10 : log10(followers) × 20. 100→20, 1K→40, 10K→60, 100K→80, 1M→100. |
| 5 | **Consistency** | 15% | Jours depuis le dernier post : <7j=100, 7-14j=75, 14-30j decline, >30j=quasi zero. |

### Formule finale
```
creator_score = performance×0.30 + engagement×0.20 + growth×0.20 + audience×0.15 + consistency×0.15
```

### Ranks

| Score | Rank | Emoji |
|-------|------|-------|
| < 20 | Newcomer | 🌱 |
| 20-39 | Creator | 🥉 |
| 40-59 | Trending Creator | 🥈 |
| 60-79 | Viral Creator | 🥇 |
| 80-89 | Elite Creator | 💎 |
| 90+ | Legendary | 👑 |
| Performance > 80 + Audience < 55 | Hidden Gem | 🔥 |

Note : Hidden Gem est evalue AVANT les seuils de score (priorite sur legendary/elite). Audience < 55 correspond a environ < 1K followers.

### API Route — POST /api/account/sync

1. Verifie auth (user connecte)
2. Rate limit : 1 sync par 24h (check `sync_count_today` et `last_sync_date`)
3. Recupere le connected account YouTube du user dans `social_accounts`
4. Refresh token OAuth YouTube si expire (via `getValidToken`)
5. Appels YouTube Data API :
   - `channels.list?part=snippet,statistics&mine=true` → subscribers, viewCount, videoCount
   - `search.list?forMine=true&type=video&order=date&maxResults=20` → IDs des 20 dernieres videos (90 jours)
   - `videos.list?part=statistics,contentDetails,snippet&id={ids}` → stats par video
6. Calcule : median_views, engagement_rate, shorts_ratio, days_since_last_post, growth_percent_30d
7. Appelle `scoreAccount()` → creator_score + creator_rank + sous-scores
8. Update `social_accounts` avec stats + score + rank
9. Insert snapshot dans `account_snapshots` (weekly si >7j depuis le dernier weekly, sinon daily)
10. Retourne le score complet

### Tables DB

**social_accounts** — colonnes ajoutees :
- `followers`, `total_views`, `video_count`, `avg_views_per_video`, `median_views_per_video`
- `engagement_rate`, `creator_score`, `creator_rank`, `primary_niche`
- `last_synced_at`, `sync_count_today`, `last_sync_date`

**account_snapshots** — historique quotidien/hebdomadaire :
- `account_id`, `platform`, `followers`, `total_views`, `video_count`
- `avg_views_per_video`, `median_views_per_video`, `engagement_rate`
- `creator_score`, `creator_rank`, `snapshot_type` (daily|weekly), `captured_at`

### UI (Settings)

- Grand badge du rank avec effets visuels (glow pour Elite, gradient pour Legendary)
- Score /100 affiche en grand
- 5 barres de progression colorees (Performance, Engagement, Growth, Audience, Consistency)
- Message motivant selon le rank
- Stats rapides (Subscribers, Median views, Videos)
- Breakdown par plateforme : YouTube (connecte), TikTok (coming soon), Instagram (coming soon)
- Bouton "Sync Now" (desactive si deja synced + "Next sync in Xh")
- Sidebar : petit badge rank cliquable → mene a Settings

### Phases

- **Phase 1 (actuelle)** : YouTube uniquement, sync manuel (1x/24h), scoring via YouTube Data API
- **Phase 2** : Cron automatique + tracking croissance 30 jours
- **Phase 3** : TikTok (scope `user.info.stats`) + Instagram (scope `instagram_manage_insights`)

## Notes Importantes
- Frontend sur **Netlify** (pas Vercel)
- FFmpeg tourne sur **Railway** (pas sur Netlify)
- Videos stockees dans **Supabase Storage**, pas en local
- Pas de n8n, pas de Claude API skills, pas de Whisper, pas de distribution multi-plateforme
- Le projet est SIMPLE : clips streamers → boost viralite → export
