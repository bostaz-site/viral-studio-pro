# VIRAL ANIMAL — Instructions pour Claude Code

## Vision Produit

Viral Animal = machine a farmer des clips viraux, en 4 etages :

### Etage 1 — Flow Manuel (LIVE)
Browse clips de streamers (Twitch/Kick) → enhance (captions karaoke, split-screen, hook IA, "Make it Viral") → export/publish vers TikTok.
C'est le produit visible, le premier contact utilisateur.

### Etage 2 — Clip Bank + Autofarm (EN CONSTRUCTION)
L'user met des clips en banque, un agent les publie automatiquement aux moments optimaux.
Feature Pro/Studio, coeur de la monetisation future.
Code existant : `lib/distribution/smart-queue-engine.ts`, `smart-publisher.ts`, `strategy-engine.ts`, `reward-engine.ts`.
UI : `components/distribution/clip-bank-rail.tsx`, `schedule-queue.tsx`, `smart-insights-widget.tsx`.

### Etage 3 — Live Moment Detection (VISION)
Poll agressif des clips Twitch des streamers suivis, spike de velocity dans les premieres minutes = gros moment → notification ou auto-enhance + auto-post AVANT tout le monde.
S'appuie sur la spike detection existante (`lib/scoring/`, cron stratifie `rescore-clips`).

### Etage 4 — Agent TikTok Personnalise (VISION, bloque par permissions API)
Agent qui analyse le compte TikTok de l'user pour personnaliser l'autofarm (timing, hashtags, style).
Route existante : `app/api/tiktok/creator-info/route.ts`.

## Realite du Launch

- **TikTok Direct Post** : APPROVED (seule plateforme active au launch)
- **YouTube / Instagram / Facebook** : affiches "coming soon", desactives (permissions en attente)
- L'autofarm auto-post devra gerer le risque contenu tiers (musique detectee par TikTok) : filtre audio ou replace-audio dans le pipeline — note au backlog
- **Plans** : Free ($0, 3 videos/mois, watermark), Pro ($19, 30 videos/mois), Studio ($24 launch / $29 regular, 120 videos/mois, multi-platform publish)
- **Stripe** : checkout + portal + webhooks integres
- **Feature flag** : `NEXT_PUBLIC_AUDIT_MODE` cache les features browse-clips pendant les reviews TikTok

## Architecture Reelle (3 couches)

### Couche 1 — Produit User (~35% du code)
Ce que l'utilisateur voit et utilise.

| Zone | Pages | Fichiers cles |
|------|-------|---------------|
| **Browse clips** | `dashboard/page.tsx` | `lib/twitch/`, `lib/kick/`, `lib/scoring/clip-scorer.ts`, `stores/trending-store.ts` |
| **Enhance editor** | `dashboard/enhance/[clipId]/page.tsx` | `components/enhance/`, `lib/ai/mood-detector.ts`, `lib/schemas/render.ts` |
| **Distribution hub** | `dashboard/distribution/page.tsx` | `components/distribution/`, `lib/distribution/`, `stores/distribution-store.ts`, `stores/schedule-store.ts` |
| **Publish** | via `UnifiedPublishDialog` | `components/distribution/unified-publish-dialog.tsx`, `app/api/publish/[platform]/route.ts` |
| **Analytics** | `dashboard/analytics/page.tsx` | `components/analytics/`, `lib/analytics.ts` |
| **Settings** | `settings/page.tsx` | `components/settings/`, Creator Rank UI, OAuth connections |
| **Auth** | `app/(auth)/` | `lib/supabase/`, Supabase Auth, OAuth `app/api/oauth/[platform]/` |
| **Landing** | `app/page.tsx` | `components/landing/` (hero, features, pricing, FAQ, testimonials) |

### Couche 2 — Growth Machine Admin (~50% du code)
Moteur d'acquisition influenceurs. Accessible uniquement aux admins (`lib/admin/is-admin.ts`).

| Systeme | Routes API | Fichiers cles |
|---------|-----------|---------------|
| **Influencer CRM** | `admin/influencers/`, `admin/inbox/` | `lib/admin/scraper/`, `lib/admin/ai/lead-scorer.ts` |
| **YouTube Scraper** | `admin/scraper/` | `lib/admin/scraper/youtube.ts`, `keyword-scorer.ts`, `distributor-graph.ts` |
| **Match Engine** | `admin/match-engine/` | `lib/admin/match-engine/scorer.ts`, `niche-matcher.ts`, `audience-matcher.ts` |
| **Offer Generator** | `admin/offer-generator/` | `lib/admin/offer-generator/template-renderer.ts`, `instantly-pusher.ts` |
| **Email Campaigns** | `admin/campaigns/`, `admin/mailboxes/` | `lib/admin/email/`, `lib/integrations/instantly/` |
| **Affiliate System** | `admin/affiliates/`, `app/api/affiliate/` | `lib/admin/affiliate-attribution.ts`, 30% commission, Stripe Connect payouts |
| **Partner Portal** | `app/partner/` (7 pages) | `lib/partner/auth.ts` (magic link), `repost-kit/`, `app/api/partner/` |
| **Video Library** | `admin/video-library/` | `lib/admin/video-library/`, promo videos pour influenceurs |
| **Compliance** | `admin/compliance/` | `lib/admin/compliance/` (GDPR export/delete, provenance enforcer, suppression list) |
| **Analytics Admin** | `admin/analytics/` (funnel, cohorts, revenue, affiliates, campaigns) | `lib/admin/analytics/` |
| **Watchdog** | `admin/watchdog/` | `lib/admin/watchdog/anomaly-detector.ts`, `checks.ts`, `notifier.ts` |
| **Cost Tracking** | `admin/costs/` | `lib/admin/costs/` |
| **Streamers** | `admin/streamers/` | CRUD + fetch clips manuels |

### Couche 3 — Automation (~15% du code)
Agents autonomes qui ameliorent le produit et la strategie.

#### The Lab (Multi-LLM Decision System)
Pipeline de deep dives en 8 phases, chacune dans `scripts/lab/phases/` :
1. **Intuition** — hypothese initiale
2. **Context** — lecture docs + code + historique
3. **Research** — articles + concurrents (web search)
4. **Metric** — KPI cible + seuil minimum
5. **Council** — Multi-LLM vote (Sonnet 4.6 + Opus 4.6 + Gemini 2.5 Pro, optionnel GPT-4o)
6. **Synthesis** — recommendation finale + kill switch
7. **Deliverable** — prompt d'implementation genere
8. **Tracking** — suivi post-ship

Config : `lib/lab/features-config.json`, `lib/lab/types.ts`, `lib/lab/llm-clients.ts`
UI admin : `app/(dashboard)/admin/lab/page.tsx`
LLM fallback chain : Claude CLI (Max subscription, $0) → Anthropic API → Gemini free tier

#### Lab Agent (Daemon local)
`scripts/lab/lab-agent.ts` — daemon Windows qui poll Supabase toutes les 30s pour les dives acceptees.
Spawne Claude Code CLI, cree branch, commit, push, PR via `gh`, ping Discord.
Heartbeat dans `lab_agent_status`. Status visible dans le dashboard admin.

#### Audit Agents (21 scripts dans `scripts/audits/`)
Nightly batch orchestre par `scripts/audits/run-nightly.ts` :
- **Quotidien** : Output Quality, Acquisition, Activation, Technical, Retention, Cold Email, AI Scout, AI Multiplier
- **Dimanche** : Strategist + Revenue + Meta-Agent + Strategic Brief
- Chaque nuit inclut 1-2 personas aleatoires (`scripts/personas/`)
- Morning brief genere via `lib/audit/morning-brief.ts` → Discord
- Framework : `lib/audit/agent-runner.ts` (Claude Haiku), findings dans `audit_findings`, metriques dans `audit_metric_snapshots`

#### AI Scoring (Leads)
`lib/admin/ai-scoring/claude-scorer.ts` — batch scoring de leads influenceurs via Claude Haiku.
Niche fit, audience, engagement, sponsorship likelihood, sentiment → score 0-100.

## Stack Technique

### Frontend
- **Next.js 14** (App Router) avec TypeScript
- **Tailwind CSS** + **shadcn/ui** pour l'UI
- **Zustand** pour le state management (8 stores)
- **Supabase Auth** pour l'authentification
- Deploiement sur **Netlify** (pas Vercel)

### Backend / Services
- **Supabase** — PostgreSQL (92 migrations, ~80 tables) + Storage + Auth + Realtime (render_jobs)
- **Railway VPS** — Serveur FFmpeg (`bostaz-site-production.up.railway.app`)
- **Upstash Redis** — Rate limiting, render queue (FIFO, `lib/render-queue.ts`), distributed locks
- **Stripe** — Checkout, portal, webhooks, Connect (affiliate payouts)
- **Instantly** — Email outreach automation (`lib/integrations/instantly/`)
- **Discord** — Notifications audits + lab (`lib/discord/post.ts`)

### APIs Externes
- **Twitch API** — Clips de streamers (`lib/twitch/`)
- **Kick API** — Clips Kick (`lib/kick/`)
- **YouTube Data API** — Creator Rank sync + scraper influenceurs
- **TikTok API** — Direct Post (approved), creator info
- **OpenAI Whisper API** — Transcription word-level sur le VPS (`vps/lib/whisper-client.js`)
- **Anthropic API** — Mood detection, hook generation, lead scoring, audit agents, Lab council
- **Google Gemini API** — Lab council (free tier)
- **ElevenLabs API** — Voice-over (Studio plan)

### VPS Railway (Render Server)
```
vps/
├── server.js                    # Express server
├── routes/
│   ├── render.js                # POST /render — main render endpoint
│   ├── download.js              # GET /download
│   └── health.js                # GET /health
├── lib/
│   ├── render-pipeline.js       # Orchestrateur principal (captions + face track + hook + render)
│   ├── ffmpeg-render.js         # FFmpeg command builder
│   ├── subtitle-generator.js   # ASS subtitle generation (karaoke styles)
│   ├── whisper-client.js        # OpenAI Whisper API transcription
│   ├── hook-generator.js        # Peak moment detection + hook text via Claude
│   ├── hook-overlay.js          # Hook text overlay FFmpeg filter
│   ├── auto-cut.js              # Silence removal using word timestamps
│   ├── face-tracker.js          # Face detection wrapper (Python)
│   ├── face-detect.py           # OpenCV face detection
│   ├── audio-peaks.js           # Audio peak analysis
│   ├── render-queue.js          # VPS-side job queue
│   ├── supabase-client.js       # DB access from VPS
│   ├── yt-dlp-wrapper.js        # Download clips via yt-dlp
│   └── logger.js                # Structured logging
```

## Structure du Projet (Simplifiee)

```
app/
├── (auth)/                      # Login, signup
├── (dashboard)/
│   ├── admin/                   # ~47 pages admin (CRM, campaigns, audits, lab, etc.)
│   ├── dashboard/               # Browse clips, enhance, distribution, analytics
│   └── settings/                # User settings, Creator Rank, OAuth
├── partner/                     # Partner portal (7 pages — login, payouts, promo-kit, repost)
├── api/                         # 170 routes (voir section Architecture)
└── page.tsx                     # Landing page

components/
├── admin/                       # Affiliate dashboard, growth, payout dialogs
├── analytics/                   # User analytics components
├── captions/                    # Caption editor, templates
├── clips/                       # ClipCard
├── distribution/                # Publish dialog, clip bank, schedule, smart queue (17 fichiers)
├── enhance/                     # Live preview, AI analysis, accordion sections
├── landing/                     # Hero, features, pricing, FAQ, testimonials (13 fichiers)
├── onboarding/                  # First clip overlay
├── publish/                     # Publish components
├── settings/                    # Creator Rank section
├── ui/                          # shadcn/ui primitives
└── video/                       # Player, timeline, upload

lib/
├── admin/                       # CRM, scraper, match engine, offer generator, campaigns,
│                                  compliance, watchdog, costs, analytics, AI scoring, stripe
├── ai/                          # Mood detector, caption engine, call logger
├── analytics.ts
├── audit/                       # Agent runner, personas, strategic runner, discord notifier
├── browse/                      # Clip verdict
├── distribution/                # Smart publisher, queue engine, strategy, rewards, platform rules
├── enhance/                     # AI analysis, scoring
├── hooks/                       # React hooks
├── integrations/instantly/      # Email outreach sync
├── kick/                        # Kick API client
├── lab/                         # LLM clients, types, features config
├── partner/                     # Auth, magic link, repost kit
├── render-queue.ts              # Redis-based FIFO render queue
├── schemas/                     # Zod schemas
├── scoring/                     # Clip scorer V2, account scorer, momentum scorer
├── supabase/                    # Client + server + admin Supabase
├── twitch/                      # Twitch API client
└── utils.ts

stores/                          # 8 Zustand stores
├── account-store.ts             # Creator Rank state
├── affiliate-store.ts           # Affiliate dashboard
├── distribution-store.ts        # Distribution hub state
├── queue-store.ts               # Smart queue
├── schedule-store.ts            # Schedule + distribution settings
├── smart-publishing-store.ts    # Auto-publish state
├── trending-store.ts            # Browse clips state
└── ui-store.ts                  # UI preferences

scripts/
├── audits/                      # 21 audit agent scripts + nightly orchestrator
├── lab/                         # Lab agent daemon + 8 pipeline phases
├── personas/                    # 3 test personas (free user, power user, sceptical first-timer)
├── business/                    # Weekly stats digest
└── knowledge-graph/             # Knowledge graph bootstrap
```

## Base de Donnees Supabase

92 migrations, ~80 tables. **RLS** active sur toutes les tables utilisateur. Admin/cron utilisent le service role.

### Tables Principales (Produit User)

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips (uploades par user ou depuis bibliotheque)
CREATE TABLE public.clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    start_time FLOAT NOT NULL, end_time FLOAT NOT NULL,
    duration_seconds FLOAT,
    storage_path TEXT, thumbnail_path TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'done', 'error')),
    is_remake BOOLEAN DEFAULT FALSE,
    parent_clip_id UUID REFERENCES public.clips(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips de streamers (bibliotheque trending)
CREATE TABLE public.trending_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,             -- 'twitch', 'kick'
    author_name TEXT, author_handle TEXT, title TEXT,
    niche TEXT,                         -- 'irl', 'fps', 'moba', etc.
    view_count BIGINT, like_count BIGINT, duration_seconds FLOAT,
    velocity_score FLOAT,               -- score final V2 (0-100)
    tier TEXT,                          -- 'mega_viral', 'viral', 'hot', 'rising', 'normal', 'dead'
    feed_category TEXT,                 -- 'early_gem', 'hot_now', 'proven', 'normal'
    momentum_score FLOAT, engagement_score FLOAT, recency_score FLOAT,
    early_signal_score FLOAT, format_score FLOAT, saturation_score FLOAT,
    next_check_at TIMESTAMPTZ,          -- cron stratifie
    streamer_id UUID REFERENCES public.streamers(id),
    clip_created_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos sources (uploads)
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'uploaded',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Render jobs (suivi des rendus FFmpeg)
CREATE TABLE public.render_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id TEXT NOT NULL,
    source TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending',
    storage_path TEXT, clip_url TEXT,
    error_message TEXT, debug_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcriptions (Whisper word-level)
CREATE TABLE public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id),
    full_text TEXT NOT NULL,
    word_timestamps JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streamers suivis
CREATE TABLE public.streamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    twitch_login TEXT, twitch_id TEXT,
    niche TEXT, priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

-- Distribution (scheduled posts)
CREATE TABLE public.scheduled_publications ( ... );
CREATE TABLE public.distribution_settings ( ... );
CREATE TABLE public.published_posts ( ... );
CREATE TABLE public.publication_performance ( ... );
```

### Tables Admin (Growth Machine)
```sql
-- Influencer CRM (core)
CREATE TABLE public.influencers ( ... );         -- ~60 colonnes, lead scoring, Stripe Connect
CREATE TABLE public.email_campaigns ( ... );
CREATE TABLE public.email_messages ( ... );
CREATE TABLE public.email_templates ( ... );
CREATE TABLE public.campaign_recipients ( ... );
CREATE TABLE public.mailboxes ( ... );
CREATE TABLE public.suppression_list ( ... );
CREATE TABLE public.domains ( ... );

-- Affiliate system
CREATE TABLE public.affiliate_codes ( ... );
CREATE TABLE public.affiliate_referrals ( ... );
CREATE TABLE public.affiliate_commission_ledger ( ... );
CREATE TABLE public.affiliate_payouts ( ... );
CREATE TABLE public.affiliate_clicks ( ... );

-- Match engine + video library
CREATE TABLE public.promo_videos ( ... );
CREATE TABLE public.video_influencer_matches ( ... );

-- Compliance + audit trail
CREATE TABLE public.compliance_audit_log ( ... );
CREATE TABLE public.admin_audit_log ( ... );
CREATE TABLE public.fraud_flags ( ... );

-- Scraper
CREATE TABLE public.scraper_saved_searches ( ... );
CREATE TABLE public.scraper_quota_usage ( ... );
```

### Tables Automation
```sql
CREATE TABLE public.audit_findings ( ... );
CREATE TABLE public.audit_metric_snapshots ( ... );
CREATE TABLE public.improvement_backlog ( ... );
CREATE TABLE public.strategic_moves ( ... );
CREATE TABLE public.lab_deep_dives ( ... );
CREATE TABLE public.lab_agent_status ( ... );
CREATE TABLE public.ai_calls ( ... );             -- cost tracking toutes les calls LLM
CREATE TABLE public.meta_agent_reports ( ... );
CREATE TABLE public.ai_multiplier_opportunities ( ... );
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
VPS_RENDER_URL=
VPS_RENDER_API_KEY=

# Twitch
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# YouTube (OAuth pour Creator Rank + scraper)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=

# Instagram (coming soon)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# AI / LLMs
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GEMINI_API_KEY=
ELEVENLABS_API_KEY=

# Lab Agent
LAB_USE_CLAUDE_CLI=true
LAB_FORCE_GEMINI=

# Discord (notifications)
DISCORD_AUDIT_WEBHOOK_URL=
DISCORD_LAB_WEBHOOK_URL=

# Email outreach (Instantly.ai)
N8N_API_KEY=
N8N_BASE_URL=

# Security
ENCRYPTION_SECRET=
CRON_SECRET=
WEBHOOK_SECRET=

# Admin
ADMIN_EMAILS=

# App
NEXT_PUBLIC_APP_URL=
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
- Toujours utiliser `next/image` pour les `<img>`
- Domaines externes d'images : ajouter a `next.config.mjs` > `images.remotePatterns`

### API Routes
- Valider les inputs (zod, schemas dans `lib/schemas/`)
- Verifier l'authentification (user routes) ou admin check (`lib/admin/is-admin.ts`)
- Reponses JSON : `{ data, error, message }`
- Cron routes protegees par `CRON_SECRET`
- Admin routes verifient `ADMIN_EMAILS` via service role

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
| 5 | **Early Signal** | 10% | Detection precoce (<6h) : vues/min x log(vues) x decay rapide |
| 6 | **Format Score** | 10% | Duree optimale TikTok/Reels : 15-45s = 100, >60s = 50 |
| 7 | **Saturation Penalty** | -10% | Penalise les vieux clips viraux (>7j + >1M vues) et les clips morts |

### Formule finale
```
final_score = momentum*0.25 + authority*0.20 + engagement*0.15 + recency*0.10
            + earlySignal*0.10 + format*0.10 - saturation*0.10
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

### Spike Detection
Si la velocity du clip depasse 2x la moyenne du streamer → boost momentum x1.5

## Cron Stratifie (Re-scoring dynamique)

Route : `app/api/cron/rescore-clips/route.ts`

| Age du clip | Frequence re-score |
|-------------|-------------------|
| < 6h | Toutes les 15 min |
| 6-24h | Toutes les heures |
| > 24h | 1 fois par jour |

Colonne `next_check_at` dans `trending_clips`. Spike (+20% vues vs snapshot precedent) → re-score immediat.

## Crons Actifs

| Cron | Route | Fonction |
|------|-------|----------|
| Rescore clips | `cron/rescore-clips` | Re-scoring stratifie des trending clips |
| Fetch Twitch clips | `cron/fetch-twitch-clips` | Import nouveaux clips des streamers suivis |
| Cleanup render jobs | `cron/cleanup-render-jobs` | Nettoie les render jobs zombies |
| Reconcile render | `cron/reconcile-render` | Reconcilie Redis vs DB |
| Reset usage | `cron/reset-usage` | Reset mensuel des quotas |
| Cleanup storage | `cron/cleanup-storage` | Supprime les fichiers orphelins |
| AI triage | `cron/ai-triage` | Triage automatique des findings |
| AI scoring | `cron/ai-scoring` | Batch scoring leads influenceurs |
| Refresh post stats | `cron/refresh-post-stats` | Met a jour les stats des posts publies |
| Monthly payouts | `cron/monthly-payouts` | Calcul payouts affilies |
| Sync Instantly | `cron/sync-instantly` | Sync CRM Instantly |
| Watchdog | `cron/watchdog` | Anomaly detection sur metriques cles |

## Systeme de Ranking Createur

Fichier principal : `lib/scoring/account-scorer.ts`
Route : `app/api/account/sync/route.ts`

### 5 Facteurs

| # | Facteur | Poids |
|---|---------|-------|
| 1 | **Performance** | 30% — Median views / followers |
| 2 | **Engagement** | 20% — (likes+comments)/views |
| 3 | **Growth** | 20% — Croissance followers 30j (log scale) |
| 4 | **Audience** | 15% — Taille absolue (log10) |
| 5 | **Consistency** | 15% — Jours depuis dernier post |

### Ranks
| Score | Rank |
|-------|------|
| < 20 | Newcomer |
| 20-39 | Creator |
| 40-59 | Trending Creator |
| 60-79 | Viral Creator |
| 80-89 | Elite Creator |
| 90+ | Legendary |
| Perf > 80 + Audience < 55 | Hidden Gem (prioritaire) |

## Render System

- Frontend poll `/api/render/status` toutes les 3s pendant le rendu
- `sessionStorage render-job:{clipId}` persiste le jobId across refreshes
- `localStorage render-done:{clipId}` persiste le download URL 24h (kill switch pour re-ouvrir le publish dialog)
- Server-side kill switch : `GET /api/render/status?clip_id=` retourne le dernier job done
- Quand un render finit : auto-ouverture du `UnifiedPublishDialog` (publish = CTA principal)
- Queue Redis FIFO : `lib/render-queue.ts`, concurrence max configurable via `RENDER_MAX_CONCURRENT`
- VPS webhook callback : `/api/render/hook` (HMAC signe)

## Deploiement

- **Frontend** : Netlify (pas Vercel)
- **VPS FFmpeg** : Railway (`bostaz-site-production.up.railway.app`)
- **Videos** : Supabase Storage (pas local)
- **Lab Agent** : daemon local Windows, tourne en permanence sur la machine de dev
- **Audit Agents** : cron nightly via `npx tsx scripts/audits/run-nightly.ts`
