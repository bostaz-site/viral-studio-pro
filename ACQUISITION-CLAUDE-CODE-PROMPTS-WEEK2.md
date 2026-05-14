# 🚀 ACQUISITION V3 — Claude Code Prompts SEMAINE 2

> **Objectif Semaine 2** : Video Library + AI Scoring + Match Engine + Offer Generator
>
> **4 prompts à lancer EN PARALLÈLE** (pas de conflit entre eux)
>
> **Pré-requis** : Week 1 mergé en prod (V3-1A/1B/1C ✅)
>
> **Output attendu fin de semaine 2** :
> - Bibliothèque de vidéos pub avec tags + métadonnées
> - AI Claude scoring sur les top leads
> - Match Algorithm rule-based vidéo ↔ influenceur
> - Personalized Offer Generator avec A/B testing
> - 4 nouveaux SYSTEM-REFERENCE docs créés

---

## 🟠 PROMPT V3-2A — Video Library (Bibliothèque vidéos pub)

```
CONTEXTE
========
Tu travailles sur Viral Animal (https://viralanimal.com), Next.js 14 + Supabase + Stripe.
Week 1 V3 mergé en prod : scraper YouTube + repost kit + compliance enhanced.

Maintenant Week 2 V3-2A : Build la bibliothèque de vidéos pub admin.
Samy (admin) va uploader des vidéos pub courtes (15-30 sec) qu'on assignera ensuite
aux influenceurs via le Match Engine (V3-2C).

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-video-library

DOCS À LIRE EN PREMIER
=======================
1. SYSTEM-REFERENCES-INDEX.md (vue d'ensemble)
2. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (Module 4 — Video Library)
3. SYSTEM-REFERENCE-ADMIN-CRM.md (pattern admin pages)
4. SYSTEM-REFERENCE-DISTRIBUTION.md (pour comprendre l'upload pattern existant)

TÂCHE
=====
1. Migration : promo_videos table + promo_video_assets + promo_video_performance
2. Page /dashboard/admin/video-library (upload + grid view)
3. Upload pipeline : Supabase Storage bucket "promo-videos"
4. Auto-extraction métadonnées (duration, dimensions, codec) via ffprobe
5. Auto-génération thumbnail à 1 seconde (ffmpeg)
6. Tagging system : niche, hook_type, tone, length_seconds, language
7. Performance tracking : views, kit_clicks, conversions par vidéo
8. Replace/archive flow (versioning)
9. Search + filter dans la grid

MIGRATIONS À CRÉER
==================

-- 20260608_promo_videos.sql
CREATE TABLE public.promo_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Video storage
  storage_path TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'promo-videos',
  hd_url TEXT,
  mobile_url TEXT,
  thumbnail_url TEXT,
  
  -- Metadata
  duration_seconds NUMERIC(6, 2),
  width INT,
  height INT,
  aspect_ratio TEXT,
  codec TEXT,
  file_size_bytes BIGINT,
  
  -- Tags (pour match engine)
  niche TEXT[] DEFAULT '{}',  -- ['ai_tools', 'productivity', 'gaming']
  hook_type TEXT CHECK (hook_type IN (
    'curiosity', 'shock', 'transformation', 'social_proof', 
    'storytelling', 'tutorial', 'comparison', 'testimonial'
  )),
  tone TEXT CHECK (tone IN ('casual', 'professional', 'funny', 'inspirational', 'edgy')),
  language TEXT DEFAULT 'en',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  replaces_video_id UUID REFERENCES promo_videos(id),
  
  -- Performance aggregates (denormalized for speed)
  total_kits_generated INT DEFAULT 0,
  total_views INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  total_signups INT DEFAULT 0,
  avg_engagement_rate NUMERIC(5, 2),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_promo_videos_status ON promo_videos(status);
CREATE INDEX idx_promo_videos_niche ON promo_videos USING GIN(niche);
CREATE INDEX idx_promo_videos_hook ON promo_videos(hook_type);
CREATE INDEX idx_promo_videos_performance ON promo_videos(total_signups DESC) WHERE status = 'active';

-- 20260608_promo_video_assets.sql
CREATE TABLE public.promo_video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('hd', 'mobile', 'square', 'gif_preview', 'thumbnail')),
  url TEXT NOT NULL,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_promo_assets_video ON promo_video_assets(promo_video_id);

-- 20260608_promo_video_performance.sql
CREATE TABLE public.promo_video_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  kits_generated INT DEFAULT 0,
  kit_views INT DEFAULT 0,
  video_completions INT DEFAULT 0,
  code_copies INT DEFAULT 0,
  posts_submitted INT DEFAULT 0,
  signups_attributed INT DEFAULT 0,
  revenue_cents NUMERIC(12, 2) DEFAULT 0,
  UNIQUE (promo_video_id, date)
);

CREATE INDEX idx_promo_perf_date ON promo_video_performance_daily(date DESC, promo_video_id);

FICHIERS À CRÉER
================

UI :
- app/(dashboard)/admin/video-library/page.tsx (grid view + filters)
- app/(dashboard)/admin/video-library/_components/video-grid.tsx
- app/(dashboard)/admin/video-library/_components/video-card.tsx
- app/(dashboard)/admin/video-library/_components/upload-dialog.tsx
- app/(dashboard)/admin/video-library/_components/tag-editor.tsx
- app/(dashboard)/admin/video-library/_components/performance-mini-chart.tsx
- app/(dashboard)/admin/video-library/[id]/page.tsx (detail view)
- app/(dashboard)/admin/video-library/[id]/_components/video-detail.tsx
- app/(dashboard)/admin/video-library/[id]/_components/performance-chart.tsx

APIs :
- app/api/admin/video-library/route.ts (GET list, POST upload)
- app/api/admin/video-library/[id]/route.ts (GET/PUT/DELETE)
- app/api/admin/video-library/[id]/assets/route.ts (manage assets)
- app/api/admin/video-library/[id]/performance/route.ts (daily perf)
- app/api/admin/video-library/upload/route.ts (signed URL for direct upload)

Libs :
- lib/admin/video-library/upload.ts (Supabase Storage handler)
- lib/admin/video-library/metadata-extractor.ts (ffprobe wrapper)
- lib/admin/video-library/thumbnail-generator.ts (ffmpeg wrapper)
- lib/admin/video-library/asset-generator.ts (HD/mobile/square versions)

SUPABASE STORAGE
================
Bucket: promo-videos
Policies:
- INSERT : admins only (requireAdminRole('manage_content'))
- SELECT : public (signed URLs for direct download)
- UPDATE/DELETE : admins only

UPLOAD FLOW
===========
1. Admin clique "Upload Video"
2. Modal : select file → POST /api/admin/video-library/upload (get signed URL)
3. Direct upload to Supabase Storage (chunked)
4. POST /api/admin/video-library with metadata + storage_path
5. Server runs ffprobe + ffmpeg en background :
   - Extract metadata (duration, dimensions)
   - Generate thumbnail at 1s
   - Generate mobile version (480p)
   - Generate GIF preview (3 sec loop)
6. Update promo_videos row + create promo_video_assets

UI GRID VIEW
============
Layout : Pinterest-style grid (4 columns desktop, 2 mobile)
Card content :
- Thumbnail (hover → preview GIF)
- Title
- Duration badge
- Niche tags (chips)
- Hook type icon
- Performance preview : "12 kits / 3 signups / $89"
- Status badge (active/paused/archived)

Actions par card :
- View Detail
- Edit Tags
- Pause/Activate
- Archive
- Duplicate

DEFINITION OF DONE
==================
- [ ] 3 migrations applied
- [ ] Supabase Storage bucket "promo-videos" créé avec policies
- [ ] /dashboard/admin/video-library accessible avec grid
- [ ] Upload modal fonctionne (drag-drop + direct upload)
- [ ] Auto-extraction metadata (duration, dimensions, codec)
- [ ] Auto-thumbnail generation
- [ ] Auto-mobile version (480p)
- [ ] Tag editor inline (niche, hook, tone, language)
- [ ] Performance preview par card
- [ ] Detail page avec full chart
- [ ] Archive flow (soft delete + replaces_video_id)
- [ ] SYSTEM-REFERENCE-ADMIN-VIDEO-LIBRARY.md créé
- [ ] Update SYSTEM-REFERENCES-INDEX.md

ANTI-PATTERNS
=============
❌ Ne PAS uploader la vidéo via POST /api/.. (use signed URL direct upload)
❌ Ne PAS générer thumbnail synchrone (background job)
❌ Ne PAS exposer le storage_path direct (use signed URLs)
❌ Ne PAS oublier les indexes GIN sur niche[]
❌ Ne PAS limiter à 1 niche par vidéo (TEXT[] = multi)
❌ Ne PAS hard-delete (archive only — référencé par repost_kit_sessions)

OUTPUT FINAL
============
SYSTEM-REFERENCE-ADMIN-VIDEO-LIBRARY.md format SYSTEM-REFERENCE-BROWSE.md :
- Architecture
- Upload pipeline
- Storage bucket policies
- Tag taxonomy
- Performance tracking
- API endpoints
- Anti-patterns
```

---

## 🔴 PROMPT V3-2B — AI Claude Scoring (Top 3% des leads)

```
CONTEXTE
========
Tu travailles sur Viral Animal (Next.js 14 + Supabase). Week 1 V3 mergé.
Scraper YouTube + keyword pre-score actifs.

Week 2 V3-2B : Build le AI Claude Scoring sur top 3% des leads (économique).
Le scraper trouve 1000 leads/jour avec keyword_score 0-100. On envoie SEULEMENT
les top 3% (~30 leads/jour) à Claude Haiku pour scoring AI approfondi.

Coût cible : <$30/mois Claude API.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-ai-scoring

DOCS À LIRE EN PREMIER
=======================
1. SYSTEM-REFERENCES-INDEX.md
2. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (Module "AI Scoring Layer")
3. SYSTEM-REFERENCE-ADMIN-AI-TRIAGE.md (pattern Claude existant)
4. SYSTEM-REFERENCE-ADMIN-SCRAPER.md (lit affiliate_signal_snapshots)

TÂCHE
=====
1. Migration : ai_scoring_jobs + ai_scoring_results tables
2. Service Claude Haiku scoring avec prompt optimisé
3. Cron job : scan affiliate_signal_snapshots toutes les heures
4. Filter : top 3% (keyword_score >= threshold dynamique)
5. Batch processing : 10 leads par call Claude (batching pour économiser)
6. Output : ai_score 0-100 + reasoning structured JSON
7. Update influencers.ai_affiliate_score
8. UI dans /dashboard/admin/scraper : afficher AI score + reasoning
9. Cost tracker : log Claude API calls dans existing cost tracker

MIGRATIONS À CRÉER
==================

-- 20260609_ai_scoring.sql
CREATE TABLE public.ai_scoring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('batch_score', 'reprocess', 'single')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  total_leads INT,
  processed_leads INT DEFAULT 0,
  failed_leads INT DEFAULT 0,
  cost_cents NUMERIC(10, 4) DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_jobs_status ON ai_scoring_jobs(status, created_at DESC);

-- ai_scoring_results déjà créé partiellement via affiliate_signal_snapshots
-- On AJOUTE des colonnes
ALTER TABLE public.affiliate_signal_snapshots
ADD COLUMN IF NOT EXISTS ai_job_id UUID REFERENCES ai_scoring_jobs(id),
ADD COLUMN IF NOT EXISTS claude_model TEXT,
ADD COLUMN IF NOT EXISTS prompt_version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS cost_cents NUMERIC(8, 4),
ADD COLUMN IF NOT EXISTS confidence NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS strengths JSONB,
ADD COLUMN IF NOT EXISTS concerns JSONB;

-- Ajout colonne ai_affiliate_score sur influencers
ALTER TABLE public.influencers
ADD COLUMN IF NOT EXISTS ai_affiliate_score INT,
ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;

CREATE INDEX idx_influencers_ai_score ON influencers(ai_affiliate_score DESC NULLS LAST) WHERE ai_affiliate_score IS NOT NULL;

FICHIERS À CRÉER
================

Service :
- lib/admin/ai-scoring/claude-scorer.ts (Claude Haiku client)
- lib/admin/ai-scoring/prompt-builder.ts (build context per lead)
- lib/admin/ai-scoring/batch-processor.ts (10-lead batches)
- lib/admin/ai-scoring/cost-tracker.ts (log to cost tracker)
- lib/admin/ai-scoring/threshold-calculator.ts (dynamic top 3% threshold)

APIs :
- app/api/admin/ai-scoring/jobs/route.ts (list + create jobs)
- app/api/admin/ai-scoring/jobs/[id]/route.ts (job detail)
- app/api/admin/ai-scoring/run-batch/route.ts (manual trigger)
- app/api/cron/ai-scoring/route.ts (Netlify cron, hourly)

UI :
- app/(dashboard)/admin/ai-scoring/page.tsx (jobs dashboard)
- app/(dashboard)/admin/ai-scoring/_components/jobs-table.tsx
- app/(dashboard)/admin/ai-scoring/_components/cost-summary.tsx
- app/(dashboard)/admin/ai-scoring/_components/score-distribution.tsx
- app/(dashboard)/admin/scraper/_components/ai-score-badge.tsx (réutilisable)

Update existing :
- app/(dashboard)/admin/scraper/_components/discovery-results-table.tsx (afficher ai_score)

CLAUDE PROMPT (optimisé pour batch)
====================================

System prompt:
"You are an expert at evaluating influencer affiliate partnership potential.
Score creators on their likelihood to accept and successfully promote a viral video editing SaaS.

Output ONLY valid JSON in this exact format:
{
  \"results\": [
    {
      \"handle\": \"...\",
      \"ai_score\": 0-100,
      \"recommendation\": \"high_priority|medium_priority|low_priority|skip\",
      \"confidence\": 0.0-1.0,
      \"strengths\": [\"...\", \"...\"],
      \"concerns\": [\"...\"],
      \"reasoning\": \"1-2 sentence summary\"
    }
  ]
}

Scoring criteria:
- Audience size & engagement (15%)
- Niche fit with creator economy/AI tools (25%)
- Already promotes apps (Distributor Graph match) (25%)
- Content quality & professionalism (15%)
- Likely responsiveness based on activity (10%)
- Affiliate signals in bio/recent posts (10%)
"

User prompt per batch (10 leads):
"Score these 10 creators:
[JSON array of {handle, bio, followers, engagement, recent_posts_summary, promoted_products, links}]"

COST OPTIMIZATION
=================
- Use Haiku (cheapest): $0.25/1M input, $1.25/1M output
- Batch 10 leads per call (reduce overhead)
- Cache by influencer_id : if scored < 7 days ago, skip
- Estimated cost : ~$0.003 per lead = $30/mo for 10k leads scored

THRESHOLD DYNAMIQUE (TOP 3%)
=============================
Function calculateDynamicThreshold() :
1. Query last 1000 discovery_results
2. Sort by keyword_score DESC
3. Take percentile 97 (top 3%)
4. Return that score as threshold
5. Only score leads >= threshold via Claude

This auto-adjusts as your scraper improves over time.

CRON JOB
========
Netlify Scheduled Function (hourly) :
- /api/cron/ai-scoring → trigger batch_score job if there are new leads
- Concurrency : max 1 job at a time (lock via row-level)

DEFINITION OF DONE
==================
- [ ] Migration applied (ai_scoring_jobs + ALTER tables)
- [ ] Claude Haiku integration tested
- [ ] Prompt produces valid JSON consistently (test 20 batches)
- [ ] Cron job triggers hourly
- [ ] Cost tracker logs API usage
- [ ] Dynamic threshold calculator works
- [ ] /dashboard/admin/ai-scoring page accessible
- [ ] AI score badge visible dans scraper results
- [ ] Reasoning expandable per lead
- [ ] SYSTEM-REFERENCE-ADMIN-AI-SCORING.md créé
- [ ] Update SYSTEM-REFERENCES-INDEX.md

ANTI-PATTERNS
=============
❌ Ne PAS scorer tous les leads (waste $$$ — top 3% seulement)
❌ Ne PAS appeler Claude sans cache (7-day TTL)
❌ Ne PAS batch > 15 leads (Claude limite contexte)
❌ Ne PAS oublier de logger les coûts (cost tracker existant)
❌ Ne PAS bloquer si Claude fail (retry 2x, then mark failed)
❌ Ne PAS dépasser $1/day sans alert

OUTPUT FINAL
============
SYSTEM-REFERENCE-ADMIN-AI-SCORING.md :
- Architecture pipeline
- Claude prompt (versioned)
- Cost optimization strategy
- Threshold logic
- Cron schedule
- API endpoints
```

---

## 🟢 PROMPT V3-2C — Match Engine (Vidéo ↔ Influenceur)

```
CONTEXTE
========
Tu travailles sur Viral Animal (Next.js 14 + Supabase). Week 1 V3 + Video Library actifs.

Week 2 V3-2C : Build le Match Engine qui assigne automatiquement la MEILLEURE 
vidéo pub à chaque influenceur scoré, basé sur niche/audience/style.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-match-engine

DOCS À LIRE EN PREMIER
=======================
1. SYSTEM-REFERENCES-INDEX.md
2. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (Module 5 — Match Algorithm)
3. SYSTEM-REFERENCE-ADMIN-VIDEO-LIBRARY.md (créé par V3-2A — lire après son merge)
4. SYSTEM-REFERENCE-ADMIN-SCRAPER.md
5. SYSTEM-REFERENCE-ADMIN-CRM.md

TÂCHE
=====
1. Migration : video_influencer_matches table
2. Rule-based matching algorithm V1 (pas de ML)
3. Score matching 0-100 entre chaque vidéo active et chaque influenceur scoré
4. Top match auto-assigné par influencer
5. Fallback : vidéo générique si aucun match > 50
6. Admin override : permet de re-assigner manuellement
7. UI dans /dashboard/admin/match-engine
8. Trigger : auto-match dès qu'un influenceur reçoit un ai_score
9. Prevent saturation : max 100 influenceurs par vidéo / 7 jours

MIGRATIONS À CRÉER
==================

-- 20260615_match_engine.sql
CREATE TABLE public.video_influencer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
  
  match_score NUMERIC(5, 2) NOT NULL,  -- 0-100
  match_breakdown JSONB,  -- {niche: 30, audience: 25, hook_fit: 20, ...}
  
  is_primary BOOLEAN DEFAULT FALSE,  -- TRUE = la vidéo assignée à cet influencer
  is_admin_override BOOLEAN DEFAULT FALSE,
  
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,  -- Re-match après expiration
  
  UNIQUE (influencer_id, promo_video_id)
);

CREATE INDEX idx_matches_influencer ON video_influencer_matches(influencer_id, match_score DESC);
CREATE INDEX idx_matches_video ON video_influencer_matches(promo_video_id, computed_at DESC);
CREATE INDEX idx_matches_primary ON video_influencer_matches(influencer_id) WHERE is_primary = TRUE;

-- 20260615_video_saturation.sql
CREATE TABLE public.video_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID NOT NULL REFERENCES promo_videos(id),
  influencer_id UUID NOT NULL REFERENCES influencers(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  email_sent_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

CREATE INDEX idx_assignment_video_date ON video_assignment_log(promo_video_id, assigned_at DESC);

FICHIERS À CRÉER
================

Lib core :
- lib/admin/match-engine/scorer.ts (compute match score 0-100)
- lib/admin/match-engine/niche-matcher.ts (intersection algorithm)
- lib/admin/match-engine/audience-matcher.ts (size + language match)
- lib/admin/match-engine/saturation-check.ts (max 100/7 days par vidéo)
- lib/admin/match-engine/auto-assigner.ts (pick top, mark primary)
- lib/admin/match-engine/triggers.ts (on ai_score updated → re-match)

APIs :
- app/api/admin/match-engine/compute/route.ts (POST trigger batch)
- app/api/admin/match-engine/influencer/[id]/route.ts (GET matches for influencer)
- app/api/admin/match-engine/override/route.ts (POST manual override)
- app/api/admin/match-engine/saturation/route.ts (GET stats)

UI :
- app/(dashboard)/admin/match-engine/page.tsx (overview)
- app/(dashboard)/admin/match-engine/_components/match-overview-stats.tsx
- app/(dashboard)/admin/match-engine/_components/match-explorer.tsx (per-influencer view)
- app/(dashboard)/admin/match-engine/_components/saturation-monitor.tsx
- app/(dashboard)/admin/match-engine/_components/override-modal.tsx

Update existing :
- app/(dashboard)/admin/influencers/[id]/page.tsx (afficher current match)

MATCH ALGORITHM RULE-BASED V1
==============================

function computeMatchScore(video, influencer): number {
  let score = 0
  const breakdown = {}
  
  // 1. Niche match (0-35 points)
  const nicheOverlap = video.niche.filter(n => influencer.tags?.includes(n)).length
  const nicheScore = Math.min(nicheOverlap * 15, 35)
  score += nicheScore
  breakdown.niche = nicheScore
  
  // 2. Audience size fit (0-25 points)
  const targetMin = video.target_audience_min ?? 1000
  const targetMax = video.target_audience_max ?? 1_000_000
  const audSize = influencer.audience_size ?? 0
  let audScore = 0
  if (audSize >= targetMin && audSize <= targetMax) {
    audScore = 25
  } else if (audSize >= targetMin / 2 && audSize <= targetMax * 2) {
    audScore = 15
  }
  score += audScore
  breakdown.audience = audScore
  
  // 3. Language match (0-15 points)
  if (video.language === influencer.language) {
    score += 15
    breakdown.language = 15
  }
  
  // 4. Hook type fit with influencer's content style (0-15 points)
  const hookFitMap = {
    'tutorial': ['educator', 'how_to', 'productivity'],
    'transformation': ['before_after', 'fitness', 'business'],
    'curiosity': ['mystery', 'storytelling', 'reveal'],
    // ...
  }
  const fits = hookFitMap[video.hook_type] ?? []
  const hookScore = fits.some(f => influencer.content_style?.includes(f)) ? 15 : 0
  score += hookScore
  breakdown.hook = hookScore
  
  // 5. AI affiliate score boost (0-10 points)
  if (influencer.ai_affiliate_score >= 80) score += 10
  else if (influencer.ai_affiliate_score >= 60) score += 5
  breakdown.ai_boost = influencer.ai_affiliate_score >= 80 ? 10 : 5
  
  return { score: Math.min(score, 100), breakdown }
}

SATURATION CHECK
================
Avant d'assigner une vidéo à un influencer :
1. Count assignments des 7 derniers jours pour cette vidéo
2. Si > 100 → skip cette vidéo, prendre next best
3. Log dans video_assignment_log

But : éviter que TikTok algo pénalise une vidéo postée 500 fois identique.

FALLBACK
========
Si aucun match > 50 :
- Assigner la vidéo générique (tagged "generic")
- Marker is_admin_override = false
- Add to admin review queue

AUTO-MATCH TRIGGER
==================
Postgres trigger sur influencers UPDATE :
- WHEN OLD.ai_affiliate_score IS NULL AND NEW.ai_affiliate_score IS NOT NULL
- Calls Edge function /api/admin/match-engine/compute pour ce lead

DEFINITION OF DONE
==================
- [ ] 2 migrations applied
- [ ] Scorer function produces consistent results
- [ ] Auto-match trigger on ai_score updated
- [ ] Saturation check enforced (100/7days max)
- [ ] Fallback à vidéo générique works
- [ ] /dashboard/admin/match-engine accessible
- [ ] Manual override fonctionne
- [ ] Match breakdown visible (pourquoi ce match)
- [ ] SYSTEM-REFERENCE-ADMIN-MATCH-ENGINE.md créé
- [ ] Update SYSTEM-REFERENCES-INDEX.md

ANTI-PATTERNS
=============
❌ Ne PAS faire de ML model V1 (rule-based suffit)
❌ Ne PAS recomputer tous les matches à chaque update (incremental)
❌ Ne PAS ignorer la saturation (algo TikTok va pénaliser)
❌ Ne PAS auto-assigner si match < 50 (fallback générique)
❌ Ne PAS oublier le breakdown (transparence = trust)
❌ Ne PAS bloquer admin override

OUTPUT FINAL
============
SYSTEM-REFERENCE-ADMIN-MATCH-ENGINE.md :
- Architecture
- Scoring algorithm v1 (rule-based)
- Saturation strategy
- Fallback flow
- Admin override
- Trigger mechanism
```

---

## 🟣 PROMPT V3-2D — Personalized Offer Generator (Email + A/B)

```
CONTEXTE
========
Tu travailles sur Viral Animal (Next.js 14 + Supabase). Week 1 V3 mergé.
Video Library + AI Scoring + Match Engine en cours/done.

Week 2 V3-2D : Build le Personalized Offer Generator.
Pour chaque influencer scoré + matché à une vidéo, générer un email ULTRA personnalisé
avec lien direct vers son /partner/repost/[handle] kit.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-offer-generator

DOCS À LIRE EN PREMIER
=======================
1. SYSTEM-REFERENCES-INDEX.md
2. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (Module 6 — Personalized Offer)
3. SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md (pattern email existant)
4. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md (commission ledger)
5. SYSTEM-REFERENCE-ADMIN-REPOST-KIT.md (landing page cible)

TÂCHE
=====
1. Migration : offer_templates + generated_offers + ab_variants tables
2. 5 templates email de base (différents angles)
3. Variable substitution engine ({{first_name}}, {{recent_topic}}, etc.)
4. Subject line A/B testing : 3 variants per template
5. Preview generator avant send
6. Integration avec Instantly (campaign créé dynamiquement)
7. UI /dashboard/admin/offer-generator
8. Bulk generate : 50 offres en 1 click
9. Compliance pre-flight : validateContact() + FTC check

MIGRATIONS À CRÉER
==================

-- 20260622_offer_templates.sql
CREATE TABLE public.offer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Email content
  subject_line_variants JSONB NOT NULL,  -- ["Subject A", "Subject B", "Subject C"]
  body_template TEXT NOT NULL,  -- avec {{variables}}
  
  -- Targeting
  niche TEXT[],
  audience_min INT,
  audience_max INT,
  language TEXT DEFAULT 'en',
  
  -- A/B test
  ab_variant_label TEXT,
  
  -- Performance
  total_sent INT DEFAULT 0,
  total_opens INT DEFAULT 0,
  total_replies INT DEFAULT 0,
  total_kit_views INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_status ON offer_templates(status);
CREATE INDEX idx_templates_niche ON offer_templates USING GIN(niche);

-- 20260622_generated_offers.sql
CREATE TABLE public.generated_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES offer_templates(id),
  promo_video_id UUID REFERENCES promo_videos(id),
  match_id UUID REFERENCES video_influencer_matches(id),
  
  -- Generated content
  selected_subject_variant INT,
  rendered_subject TEXT,
  rendered_body TEXT,
  repost_kit_url TEXT,
  
  -- Variables used
  variables_used JSONB,
  
  -- Compliance check
  passed_compliance BOOLEAN DEFAULT FALSE,
  compliance_blocks JSONB,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'queued', 'sent', 'opened', 'replied', 'posted', 'bounced', 'failed'
  )),
  campaign_recipient_id UUID REFERENCES campaign_recipients(id),
  
  -- Tracking
  generated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);

CREATE INDEX idx_offers_influencer ON generated_offers(influencer_id, generated_at DESC);
CREATE INDEX idx_offers_status ON generated_offers(status, generated_at DESC);
CREATE INDEX idx_offers_template ON generated_offers(template_id);

FICHIERS À CRÉER
================

Lib :
- lib/admin/offer-generator/variable-extractor.ts (build vars per influencer)
- lib/admin/offer-generator/template-renderer.ts (substitute {{vars}})
- lib/admin/offer-generator/subject-picker.ts (A/B variant chooser)
- lib/admin/offer-generator/compliance-preflight.ts (validateContact wrapper)
- lib/admin/offer-generator/repost-kit-url-builder.ts
- lib/admin/offer-generator/instantly-pusher.ts (push to Instantly campaign)
- lib/admin/offer-generator/templates-seed.ts (5 default templates)

APIs :
- app/api/admin/offer-generator/templates/route.ts (CRUD templates)
- app/api/admin/offer-generator/templates/[id]/route.ts
- app/api/admin/offer-generator/generate/route.ts (POST bulk generate)
- app/api/admin/offer-generator/preview/route.ts (POST preview before send)
- app/api/admin/offer-generator/offers/route.ts (list generated)
- app/api/admin/offer-generator/send/route.ts (POST push to Instantly)

UI :
- app/(dashboard)/admin/offer-generator/page.tsx
- app/(dashboard)/admin/offer-generator/_components/template-list.tsx
- app/(dashboard)/admin/offer-generator/_components/template-editor.tsx
- app/(dashboard)/admin/offer-generator/_components/bulk-generate-modal.tsx
- app/(dashboard)/admin/offer-generator/_components/offer-preview.tsx
- app/(dashboard)/admin/offer-generator/_components/ab-stats-chart.tsx
- app/(dashboard)/admin/offer-generator/templates/[id]/page.tsx (edit + stats)

5 TEMPLATES DE BASE (seed data)
================================

Template 1 — "Direct Affiliate Pitch"
Subjects:
- "Quick idea for {{first_name}} 🎬"
- "{{first_name}}, your {{niche}} content + my AI tool?"
- "1-min ask, {{first_name}} (re: monetization)"

Body:
"Hey {{first_name}},

Saw your {{recent_topic}} video — {{specific_compliment}}. 

I built Viral Animal — AI that turns streams into viral clips.
30% recurring commission on every signup from your code.

I already filmed a 20-sec promo matched to your audience.
Just react + repost (45 sec of your time):
→ {{repost_kit_url}}

Worth a look?
Samy"

Template 2 — "Tools You Use Angle"
Template 3 — "Side Hustle Angle"
Template 4 — "Already Promoting Apps Angle" (utilise promoted_products)
Template 5 — "Storyteller Angle"

VARIABLES DISPONIBLES
======================
{{first_name}}
{{full_name}}
{{handle}}
{{platform}}
{{follower_count_formatted}} (e.g. "47K")
{{niche}} (primary niche)
{{recent_topic}} (from last video title)
{{specific_compliment}} (AI-generated, optional)
{{promoted_apps}} (from Distributor Graph, e.g. "OpusClip and Submagic")
{{repost_kit_url}} (https://viralanimal.com/partner/repost/{{handle}})
{{commission_rate}} (30%)
{{projected_monthly_earning}} (calculated from audience)

COMPLIANCE PRE-FLIGHT
=====================
Avant de générer une offre :
1. validateContact({ email, handle, profile_url, source_url, intent: 'send_email' })
2. Check si email existe + has provenance
3. Check FTC disclosure dans body (auto-add #ad si manquant)
4. Log block dans compliance_audit_log si bloqué

BULK GENERATE FLOW
==================
1. Admin clique "Bulk Generate"
2. Filtres : niche, ai_score min, has_email, has_match
3. Preview list : "Will generate 47 offers"
4. Click "Generate" → background job
5. Pour chaque influencer :
   a. Compliance pre-flight (skip si bloqué)
   b. Pick template (basé sur niche match)
   c. Pick subject variant (round-robin A/B)
   d. Render body avec variables
   e. INSERT generated_offers
6. Show summary : "47 generated, 3 blocked by compliance"
7. Optional : "Send all via Instantly" button

DEFINITION OF DONE
==================
- [ ] 2 migrations applied + 5 templates seedés
- [ ] Variable extractor build correct context per lead
- [ ] Template renderer substitute toutes variables
- [ ] Subject A/B picker fonctionne (round-robin)
- [ ] Compliance pre-flight bloque sans source_url
- [ ] FTC disclosure auto-injected
- [ ] Preview avant send fonctionne
- [ ] Bulk generate 50 offers en < 30 sec
- [ ] Push to Instantly fonctionne
- [ ] A/B stats chart par template
- [ ] SYSTEM-REFERENCE-ADMIN-OFFER-GENERATOR.md créé
- [ ] Update SYSTEM-REFERENCES-INDEX.md

ANTI-PATTERNS
=============
❌ Ne PAS skip compliance pre-flight
❌ Ne PAS hardcode subject lines (toujours A/B)
❌ Ne PAS oublier {{repost_kit_url}} avec handle correct
❌ Ne PAS générer si pas de match (require match_id)
❌ Ne PAS envoyer direct (toujours staging dans generated_offers d'abord)
❌ Ne PAS oublier le specific_compliment (différenciation)
❌ Ne PAS spammer la même variant (round-robin propre)

OUTPUT FINAL
============
SYSTEM-REFERENCE-ADMIN-OFFER-GENERATOR.md :
- Architecture
- Template structure
- Variables disponibles
- A/B testing strategy
- Compliance integration
- Instantly push flow
- Performance metrics
```

---

## 📋 ORDRE D'EXÉCUTION

### Lance les 4 prompts EN PARALLÈLE

Aucun conflit majeur :
- **V3-2A** Video Library (tables promo_videos*)
- **V3-2B** AI Scoring (tables ai_scoring_*)
- **V3-2C** Match Engine (tables matches — dépend de V3-2A pour test seulement)
- **V3-2D** Offer Generator (tables offers — dépend de V3-2A et V3-2C pour test)

### Durée estimée : 4-6h en parallèle

### Merge order final
1. **V3-2A** Video Library (foundation)
2. **V3-2B** AI Scoring (autonome)
3. **V3-2C** Match Engine (utilise A et B)
4. **V3-2D** Offer Generator (utilise A, B, C)

---

## ✅ Definition of Done — Semaine 2 globale

- [ ] 9+ nouvelles tables Supabase apply
- [ ] Page `/dashboard/admin/video-library` fonctionnelle
- [ ] Page `/dashboard/admin/ai-scoring` accessible
- [ ] Page `/dashboard/admin/match-engine` accessible
- [ ] Page `/dashboard/admin/offer-generator` accessible
- [ ] Pipeline E2E : scraper → AI score → match → offer généré
- [ ] Compliance enforced à toutes les étapes
- [ ] 4 SYSTEM-REFERENCE docs créés
- [ ] SYSTEM-REFERENCES-INDEX.md à jour
- [ ] npm run build passe sans erreur

---

## 🎯 APRÈS SEMAINE 2

À la fin de la semaine 2, tu pourras :
1. Scraper YouTube → trouve 1000 leads/jour
2. AI Claude score les top 30 → top 10 high priority
3. Match Engine assigne la meilleure vidéo à chaque top lead
4. Offer Generator crée 30 emails ultra perso avec lien repost kit
5. Push vers Instantly → 30 emails envoyés
6. Influencer reçoit email → clique kit → repost en 45 sec
7. Tu gagnes 30% recurring sur chaque signup

**MACHINE D'ACQUISITION = LIVE.**

---

*Document créé : 13 mai 2026*
*Pré-requis : Week 1 mergé ✅*
*Output attendu : Acquisition Machine E2E fonctionnelle*
