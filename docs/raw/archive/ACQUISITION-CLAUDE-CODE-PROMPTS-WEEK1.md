# 🚀 ACQUISITION V3 — Claude Code Prompts SEMAINE 1

> **Objectif Semaine 1** : Scraper Core + Repost Kit Prototype + Compliance Layer Enhancement
>
> **3 prompts à lancer en PARALLÈLE** dans Claude Code (pas de conflits entre eux).
>
> **Pré-requis** : Vague 1 + Vague 2 LIVE en prod (déjà fait). Master Plan V3 reviewed.
>
> **Output attendu fin de semaine** :
> - 1000+ leads YouTube découverts avec provenance
> - Repost Kit prototype `/partner/repost/[handle]` fonctionnel
> - Compliance by Design rules enforced (4-way suppression)
> - 3 nouveaux SYSTEM-REFERENCE docs créés

---

## 🟢 PROMPT V3-1A — Scraper Core + Discovery + Contact Extraction

```
CONTEXTE
========
Tu travailles sur Viral Animal (https://viralanimal.com), Next.js 14 + Supabase + Stripe.
Vague 1 + Vague 2 sont LIVE en prod. Master Plan V3 acquisition system reviewed et validé.

On commence Semaine 1 du build V3 : Scraper Core + Discovery Layer + Contact Extraction.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-scraper

DOCS À LIRE EN PREMIER
=======================
1. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (sections : Module 1 Discovery, Module 2 Contact Extraction, Module 3 Signal Detection, Compliance by Design)
2. SYSTEM-REFERENCE-ADMIN-CRM.md (pour pattern import + dedup CITEXT existant)
3. SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md (pour suppression list existante)
4. SYSTEM-REFERENCE-BROWSE.md (format référence à suivre)

TÂCHE
=====
1. 10 nouvelles tables Supabase (Scraper + Discovery + Contact + Distributor Graph)
2. Page /dashboard/admin/scraper avec tab YouTube fonctionnel
3. YouTube Data API integration (search + channels + enrichment)
4. Public contact extraction avec provenance OBLIGATOIRE (source_url + found_at)
5. Keyword pre-score (regex affiliate signals)
6. Quota tracking + rate limiting
7. Distributor Graph (promoted_products table — detect créateurs qui promeuvent déjà OpusClip/Submagic/etc.)
8. CRM import avec dedup + 4-way suppression check

MIGRATIONS À CRÉER (dans supabase/migrations/)
===============================================

-- 20260601_acquisition_discovery_tables.sql
CREATE TABLE public.lead_discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform TEXT NOT NULL CHECK (source_platform IN ('youtube','tiktok','instagram','google','linktree','manual','competitor_hunter')),
  query TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_found INT DEFAULT 0,
  total_imported INT DEFAULT 0,
  error_count INT DEFAULT 0,
  cost_cents NUMERIC(10, 4) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.lead_discovery_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES lead_discovery_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT,
  profile_url TEXT,
  display_name TEXT,
  bio TEXT,
  followers INT,
  engagement_rate NUMERIC(5, 2),
  last_post_at TIMESTAMPTZ,
  raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered','enriched','scored','imported','skipped','failed'
  )),
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_discovery_results_run ON lead_discovery_results(run_id);
CREATE INDEX idx_discovery_results_status ON lead_discovery_results(status, created_at DESC);

-- 20260601_acquisition_contact_provenance.sql ⭐ CRITIQUE
CREATE TABLE public.public_contact_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_result_id UUID REFERENCES lead_discovery_results(id) ON DELETE SET NULL,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email','website','linktree','beacons','instagram','tiktok','youtube','twitter')),
  value TEXT NOT NULL,
  source_url TEXT NOT NULL,          -- ⭐ OBLIGATOIRE pour audit
  source_context TEXT,
  confidence NUMERIC(3, 2) DEFAULT 1.0,
  is_business_contact BOOLEAN DEFAULT FALSE,
  found_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_contact_points_value ON public_contact_points(lower(value));
CREATE INDEX idx_contact_points_influencer ON public_contact_points(influencer_id);
CREATE INDEX idx_contact_points_type ON public_contact_points(type, found_at DESC);

-- 20260601_acquisition_signal_detection.sql
CREATE TABLE public.affiliate_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_result_id UUID REFERENCES lead_discovery_results(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  signals JSONB DEFAULT '{}'::jsonb,
  keyword_score INT DEFAULT 0,
  ai_score INT,
  ai_reasoning JSONB,
  recommendation TEXT CHECK (recommendation IN ('high_priority','medium_priority','low_priority','skip')),
  computed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_signal_snapshots_influencer ON affiliate_signal_snapshots(influencer_id, computed_at DESC);

-- 20260601_acquisition_distributor_graph.sql 🆕 KILLER FEATURE
CREATE TABLE public.promoted_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_category TEXT,
  evidence_url TEXT,
  evidence_text TEXT,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  detection_method TEXT,
  UNIQUE (influencer_id, lower(product_name))
);

CREATE INDEX idx_promoted_products_influencer ON promoted_products(influencer_id);
CREATE INDEX idx_promoted_products_category ON promoted_products(product_category);

-- 20260601_acquisition_scraper_meta.sql
CREATE TABLE public.scraper_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_result_count INT,
  quality_metrics JSONB DEFAULT '{}'::jsonb,
  source_status TEXT DEFAULT 'active' CHECK (source_status IN ('active','cooling_down','paused','killed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.scraper_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  api_name TEXT NOT NULL,
  calls_count INT NOT NULL DEFAULT 0,
  quota_limit INT,
  usage_date DATE NOT NULL,
  reset_at TIMESTAMPTZ,
  UNIQUE (platform, api_name, usage_date)
);

CREATE TABLE public.scraper_source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy','degraded','blocked','disabled')),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_rate NUMERIC(5, 4) DEFAULT 0,
  blocked_count INT DEFAULT 0,
  notes TEXT
);

CREATE TABLE public.scraper_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  endpoint TEXT,
  current_count INT DEFAULT 0,
  limit_value INT NOT NULL,
  window_seconds INT NOT NULL,
  window_started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (platform, endpoint)
);

-- 20260601_acquisition_no_email_bucket.sql 🆕
CREATE TABLE public.high_intent_no_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_result_id UUID REFERENCES lead_discovery_results(id),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  profile_url TEXT,
  affiliate_score INT,
  reason_to_contact TEXT,
  follow_strategy TEXT CHECK (follow_strategy IN ('dm','comment','retarget','wait_for_email_update')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (platform, handle)
);

CREATE INDEX idx_no_email_score ON high_intent_no_email(affiliate_score DESC) WHERE follow_strategy IS NOT NULL;

FICHIERS À CRÉER
================

UI :
- app/(dashboard)/admin/scraper/page.tsx (page principale avec tab system)
- app/(dashboard)/admin/scraper/_components/scraper-tabs.tsx
- app/(dashboard)/admin/scraper/_components/youtube-scraper-form.tsx
- app/(dashboard)/admin/scraper/_components/discovery-results-table.tsx
- app/(dashboard)/admin/scraper/_components/quota-panel.tsx
- app/(dashboard)/admin/scraper/_components/saved-searches.tsx

APIs :
- app/api/admin/scraper/youtube/route.ts (POST search + GET results)
- app/api/admin/scraper/runs/route.ts (list runs + status)
- app/api/admin/scraper/runs/[id]/route.ts (run detail)
- app/api/admin/scraper/import/route.ts (bulk import to CRM)
- app/api/admin/scraper/saved-searches/route.ts (CRUD)
- app/api/admin/scraper/quota/route.ts (quota status)

Libs :
- lib/admin/scraper/youtube.ts (Data API v3 client)
- lib/admin/scraper/email-extractor.ts (regex + provenance)
- lib/admin/scraper/keyword-scorer.ts (cheap affiliate signal detection)
- lib/admin/scraper/distributor-graph.ts (detect promoted products)
- lib/admin/scraper/quota-tracker.ts
- lib/admin/scraper/source-health.ts

YOUTUBE DATA API
================
Env: YOUTUBE_API_KEY (déjà existant ✅)

Endpoints utilisés :
- GET /youtube/v3/search?q={query}&type=channel (discovery)
  - Coût : 100 units/call
- GET /youtube/v3/channels?id={id}&part=snippet,statistics,brandingSettings (enrichment)
  - Coût : 1 unit/call (jusqu'à 50 IDs par call)
- GET /youtube/v3/channels?forUsername={name} (lookup by handle)

Quota : 10,000 units/day (gratuit)
Stratégie : 1 search = 100 units → max 100 searches/jour MAIS chaque search retourne 50 channels = 5,000 channels/jour theoretical max.

Réalisme : 30-50 searches ciblées/jour avec batch enrichment = 1500-2500 leads/jour.

KEYWORD PRE-SCORE (CHEAP, FAST)
================================
function keywordAffiliateScore(profile): number {
  let score = 0
  const text = [profile.bio, ...profile.recentDescriptions].join(' ').toLowerCase()
  
  // Strong signals (+15 each, max 60)
  const strong = ['use code', 'promo code', 'affiliate', 'partner', 'sponsored', '#ad']
  strong.forEach(kw => { if (text.includes(kw)) score += 15 })
  
  // Medium signals (+10 each)
  const medium = ['link in bio', 'tools i use', 'apps i love', 'discount', 'collab']
  medium.forEach(kw => { if (text.includes(kw)) score += 10 })
  
  // Multi-monetization (+15)
  if (profile.linksCount >= 3) score += 15
  
  // Linktree/Beacons (+10)
  if (profile.links?.some(l => /linktr\.ee|beacons|stan|carrd/i.test(l))) score += 10
  
  return Math.min(score, 100)
}

DISTRIBUTOR GRAPH DETECTION
============================
Pour chaque channel, detect mentions of competitor/related products :

const PRODUCT_KEYWORDS = {
  'OpusClip': ['opusclip', 'opus clip'],
  'Submagic': ['submagic'],
  'Captions AI': ['captions ai', 'captions.ai'],
  'Vidyo.ai': ['vidyo', 'vidyo.ai'],
  'Notion': ['notion'],
  'CapCut': ['capcut'],
  'Descript': ['descript'],
  // ... 50+ products
}

For each text (bio + recent descriptions) :
  scan for product mentions
  if found → INSERT INTO promoted_products

Score bonus : +20 si created au moins 1 entry dans promoted_products.

4-WAY SUPPRESSION CHECK
=======================
Avant d'importer un lead, check :
1. suppression_list WHERE email = lead.email
2. suppression_list WHERE domain = lead.email_domain (e.g. "spammy.com")
3. suppression_list WHERE platform_handle = lead.handle
4. suppression_list WHERE profile_url = lead.profile_url

Si match → status='skipped', skip_reason='suppressed'

⚠️ Need to ALTER TABLE suppression_list ADD COLUMN platform_handle TEXT, ADD COLUMN profile_url TEXT.

UI /dashboard/admin/scraper
============================
- Header avec stats : "Today: X leads found / Y imported / quota X/10000"
- Tabs : YouTube (active V3.1) / TikTok (Coming Soon) / Instagram (Coming Soon) / Google Search (Coming Soon)
- Tab YouTube :
  - Form filtres :
    - Query (text)
    - Niche (dropdown : AI tools / productivity / side hustle / app reviews / creator tools / etc.)
    - Min audience
    - Max audience
    - Language
    - Active last X days
  - "Saved searches" dropdown
  - "Run search" button
  - Loading state ("Fetching... X/100 results")
  - Results table :
    - Avatar | Handle | Subscribers | Engagement | Keyword Score | Has Email | Promoted Products | Action
    - Bulk select
    - Filter results post-search
  - Action buttons :
    - "Import selected to CRM"
    - "Save search as preset"
    - "Export results CSV"

DEFINITION OF DONE
==================
- [ ] 10 migrations apply en prod
- [ ] /dashboard/admin/scraper accessible avec tab YouTube
- [ ] Saved search peut être créé + relancé
- [ ] YouTube search retourne 50+ channels avec data complète
- [ ] Email extraction depuis About page fonctionne avec source_url stocké
- [ ] Keyword pre-score calculé pour chaque result
- [ ] Distributor graph detecte au moins 5 produits courants
- [ ] Bulk import vers influencers respecte 4-way suppression
- [ ] Quota tracking visible dans UI
- [ ] Source health monitoring fonctionne
- [ ] SYSTEM-REFERENCE-ADMIN-SCRAPER.md créé

ANTI-PATTERNS
=============
❌ Ne PAS sauvegarder un email sans source_url (NO source = NO contact rule)
❌ Ne PAS appeler Claude AI dans ce prompt (c'est V3-1D, Semaine 2)
❌ Ne PAS faire search.list sur queries vagues (waste quota)
❌ Ne PAS exposer YOUTUBE_API_KEY côté client
❌ Ne PAS importer sans 4-way suppression check
❌ Ne PAS oublier de marquer is_business_contact=true si email trouvé dans About page YouTube

OUTPUT FINAL
============
SYSTEM-REFERENCE-ADMIN-SCRAPER.md suivant exactement format SYSTEM-REFERENCE-BROWSE.md :
- Architecture (table des fichiers)
- Layout pages
- State management
- API endpoints
- DB tables
- 3-tier strategy (API > HTML > Playwright)
- Quota strategy
- Compliance rules
```

---

## 🟣 PROMPT V3-1B — Repost Kit Prototype + Tracking Events

```
CONTEXTE
========
Tu travailles sur Viral Animal (Next.js 14 + Supabase + Stripe).
Vague 1 + Vague 2 LIVE. Partner Portal (/partner) déjà existant avec magic link auth.

On commence Semaine 1 V3 : Repost Kit Prototype + Tracking Events granulaires.

⭐ IMPORTANT : Le Repost Kit est le POINT DE CONVERSION #1 du système d'acquisition.
Il doit être prêt EARLY pour qu'on puisse tester l'UX avant de scaler le scraper.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-repost-kit

DOCS À LIRE EN PREMIER
=======================
1. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (Module 7 — One-Click Reposting Kit)
2. SYSTEM-REFERENCE-PARTNER-PORTAL.md (pattern auth + layout)
3. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md (commission ledger pour projected earnings)

TÂCHE
=====
1. Page publique `/partner/repost/[handle]` (no auth needed, accessible via lien email)
2. Mobile-first layout (la majorité des creators sur mobile)
3. 10+ tracking events granulaires (kit_viewed, video_played, video_25_percent, etc.)
4. Caption avec disclosure FTC intégré (compliance!)
5. One-tap mobile actions (Open TikTok/Instagram/YouTube)
6. Submit post URL form
7. Progress bar 3 steps (Download → Copy → Submit)
8. Projected commission display
9. Social proof "X other creators reposted this"
10. Customize button (request different angle)

MIGRATIONS À CRÉER
==================

-- 20260602_repost_kit_tracking.sql
CREATE TABLE public.repost_kit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  promo_video_id UUID,  -- nullable car prototype peut avoir fake data
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  campaign_recipient_id UUID REFERENCES campaign_recipients(id) ON DELETE SET NULL,
  session_token TEXT UNIQUE,
  user_agent TEXT,
  ip_hash TEXT,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  post_url TEXT,
  post_submitted_at TIMESTAMPTZ
);

CREATE INDEX idx_kit_sessions_influencer ON repost_kit_sessions(influencer_id, started_at DESC);
CREATE INDEX idx_kit_sessions_campaign ON repost_kit_sessions(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE TABLE public.repost_kit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES repost_kit_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'kit_viewed',
    'video_played',
    'video_25_percent',
    'video_50_percent',
    'video_75_percent',
    'video_completed',
    'download_hd_clicked',
    'download_mobile_clicked',
    'caption_copied',
    'code_copied',
    'hashtags_copied',
    'platform_opened',
    'post_url_submitted',
    'customization_requested',
    'angle_changed',
    'help_clicked'
  )),
  metadata JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_kit_events_session ON repost_kit_events(session_id, occurred_at);
CREATE INDEX idx_kit_events_type ON repost_kit_events(event_type, occurred_at DESC);

FICHIERS À CRÉER
================

Page publique :
- app/partner/repost/[handle]/page.tsx (Server Component avec session creation)
- app/partner/repost/[handle]/_components/repost-kit-client.tsx (Client Component avec tracking)
- app/partner/repost/[handle]/_components/video-player-tracked.tsx
- app/partner/repost/[handle]/_components/code-copy-card.tsx
- app/partner/repost/[handle]/_components/caption-card.tsx (avec disclosure)
- app/partner/repost/[handle]/_components/progress-tracker.tsx
- app/partner/repost/[handle]/_components/social-proof.tsx
- app/partner/repost/[handle]/_components/projected-commission.tsx
- app/partner/repost/[handle]/_components/mobile-actions.tsx
- app/partner/repost/[handle]/_components/submit-post-form.tsx
- app/partner/repost/[handle]/_components/customize-button.tsx

APIs :
- app/api/partner/repost/[handle]/route.ts (GET data for kit)
- app/api/partner/repost/[handle]/events/route.ts (POST tracking events)
- app/api/partner/repost/[handle]/submit/route.ts (POST post URL)
- app/api/partner/repost/[handle]/customize/route.ts (POST customization request)

Lib :
- lib/partner/repost-kit/session.ts (create + track sessions)
- lib/partner/repost-kit/tracker.ts (batch event sender)
- lib/partner/repost-kit/projected-commission.ts (calc estimation)

LAYOUT V3 MOBILE-FIRST
======================

Structure (verticale, mobile-first) :

1. HEADER
   "Hi {{first_name}} 👋"
   "Your repost kit is ready ⚡"

2. VIDEO SECTION
   - Video player (auto-play muted)
   - "⏱️ Time to post: ~45 seconds"
   - 2 buttons : [Download HD] [Download Mobile]
   - Track: video_played, video_25, video_50, video_75, video_completed

3. CODE SECTION
   - Big box : "Your Code: VIRAL-{{HANDLE}}"
   - [Copy Code] button (tracking : code_copied)
   - "💰 30% recurring commission on every signup"

4. CAPTION SECTION (avec disclosure FTC)
   Format suggéré :
   "#ad I'm testing Viral Animal — it turns my streams into viral clips automatically 🤯
   
   Use code VIRAL-{{HANDLE}} for free access
   → viralanimal.com/r/{{handle}}
   
   #appreview #productivity #aitools"
   
   [Copy Caption] button (tracking : caption_copied)

5. HASHTAGS SECTION
   "Optimized for your niche:"
   #appreview #productivitytools #aitools #saasreview
   [Copy Hashtags]

6. PROJECTED COMMISSION
   "If 10k people see this and 0.2% sign up:
    20 signups → estimated $200-400/mo potential"

7. PROGRESS BAR (3 steps)
   ✅ Step 1: Download video
   ⏳ Step 2: Copy caption
   ⬜ Step 3: Submit post URL

8. MOBILE ONE-TAP ACTIONS (only on mobile)
   [Open TikTok] [Open Instagram] [Open YouTube]
   (deep links si possible)

9. SUBMIT POST URL FORM
   "After you post, share the link:"
   [https://tiktok.com/... ] [Submit Post]
   (tracking : post_url_submitted)

10. SOCIAL PROOF
    "47 creators posted this video last week.
     Top earner: $1,240 this month."

11. CUSTOMIZATION CTA
    "Want a different angle?"
    [More money-focused] [More funny] [More professional]
    (tracking : customization_requested + angle_changed)

12. HELP
    [Need help reposting?] (tracking : help_clicked)

TRACKING IMPLEMENTATION
=======================

Strategy : Batch events client-side + flush every 5 sec OR on important events.

```typescript
// lib/partner/repost-kit/tracker.ts
class KitTracker {
  private queue: TrackingEvent[] = []
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
    setInterval(() => this.flush(), 5000)
    window.addEventListener('beforeunload', () => this.flush(sync=true))
  }

  track(event_type: string, metadata?: any) {
    this.queue.push({ event_type, metadata, occurred_at: new Date() })
    // Flush immediately on critical events
    if (['download_hd_clicked', 'caption_copied', 'post_url_submitted'].includes(event_type)) {
      this.flush()
    }
  }

  async flush() {
    if (this.queue.length === 0) return
    const events = this.queue.splice(0, this.queue.length)
    await fetch(`/api/partner/repost/${handle}/events`, {
      method: 'POST',
      body: JSON.stringify({ session_id: this.sessionId, events })
    })
  }
}
```

Pour le video player, use IntersectionObserver + video.currentTime pour tracker 25/50/75/completed milestones.

SESSION CREATION
================

GET /partner/repost/[handle] (server component) :
1. Lookup influencer by handle
2. Create new repost_kit_sessions row (no token = anonymous, but tracked)
3. Pass session_id to client component
4. Set cookie va_kit_session_id pour persistance

Optional : pass `?c={campaign_recipient_id}` dans l'URL pour attribuer la session au recipient spécifique.

PROTOTYPE V1 (data fake pour tester UX)
=========================================
Pour la première itération, accept que :
- Si le handle existe dans influencers → real data
- Sinon → fake/placeholder data avec disclaimer "Preview mode"

Comme ça tu peux tester le UX MAINTENANT sans attendre que tout le pipeline soit fait.

DEFINITION OF DONE
==================
- [ ] Migration apply en prod (repost_kit_sessions + repost_kit_events)
- [ ] /partner/repost/[handle] accessible publiquement (no auth)
- [ ] Mobile responsive
- [ ] Video player avec tracking 25/50/75/completed
- [ ] Copy buttons fonctionnent + tracking
- [ ] Submit post URL form fonctionne
- [ ] Customization request modal
- [ ] Caption inclut disclosure FTC ("#ad" ou "affiliate")
- [ ] One-tap mobile platforms (TikTok/IG/YouTube)
- [ ] Projected commission affiché
- [ ] Social proof "X creators posted"
- [ ] 10+ event types trackés correctement
- [ ] SYSTEM-REFERENCE-ADMIN-REPOST-KIT.md créé

ANTI-PATTERNS
=============
❌ Ne PAS oublier la disclosure FTC dans la caption (#ad/sponsored)
❌ Ne PAS bloquer le kit derrière auth (doit être public)
❌ Ne PAS tracker l'IP en clair (use ip_hash avec pepper)
❌ Ne PAS lourdir avec analytics third-party (juste tracking interne)
❌ Ne PAS forcer le submit post URL (optional, mais incentivé)
❌ Ne PAS oublier les boutons "Copy" pour caption ET code séparément
❌ Ne PAS rendre la page slow (lazy load video, preload nothing critical)

OUTPUT FINAL
============
SYSTEM-REFERENCE-ADMIN-REPOST-KIT.md format SYSTEM-REFERENCE-BROWSE.md :
- Architecture
- Layout sections (12 sections détaillées)
- Tracking events (16 types)
- Session lifecycle
- API endpoints
- DB tables
- Compliance (FTC disclosure)
- Mobile-first considerations
```

---

## 🔵 PROMPT V3-1C — Compliance Layer Enhancement + Provenance Rules

```
CONTEXTE
========
Tu travailles sur Viral Animal (Next.js 14 + Supabase). Compliance layer V1 existant.

On commence Semaine 1 V3 : étendre la compliance pour le scraper massif.
Règles : "No source_url = no contact", 4-way suppression, FTC disclosure check.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/acquisition-v3-compliance

DOCS À LIRE EN PREMIER
=======================
1. ACQUISITION-SYSTEM-MASTER-PLAN.md V3 (Section "Compliance by Design")
2. SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md (à mettre à jour)
3. SYSTEM-REFERENCE-ADMIN-CRM.md (pour import flow)

TÂCHE
=====
1. Étendre suppression_list : add platform_handle + profile_url columns
2. Build 4-way suppression check function
3. FTC disclosure compliance checker
4. Provenance enforcement layer (NO source_url = NO contact)
5. Bounce/unsubscribe webhook handlers updates (auto-add to suppression with 4 dimensions)
6. Compliance dashboard /dashboard/admin/compliance (NEW page)
7. Audit log toutes les actions compliance

MIGRATIONS À CRÉER
==================

-- 20260603_compliance_suppression_extended.sql
ALTER TABLE public.suppression_list
ADD COLUMN IF NOT EXISTS platform_handle TEXT,
ADD COLUMN IF NOT EXISTS profile_url TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT;

CREATE INDEX IF NOT EXISTS idx_suppression_handle ON suppression_list(lower(platform_handle), platform) WHERE platform_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppression_profile_url ON suppression_list(profile_url) WHERE profile_url IS NOT NULL;

-- Update check function for 4-way check
CREATE OR REPLACE FUNCTION is_suppressed_4way(
  p_email TEXT,
  p_handle TEXT DEFAULT NULL,
  p_profile_url TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM suppression_list
    WHERE (
      (p_email IS NOT NULL AND lower(email) = lower(p_email)) OR
      (p_email IS NOT NULL AND email_domain = split_part(p_email, '@', 2)) OR
      (p_handle IS NOT NULL AND p_platform IS NOT NULL AND lower(platform_handle) = lower(p_handle) AND platform = p_platform) OR
      (p_profile_url IS NOT NULL AND profile_url = p_profile_url)
    )
    AND (expires_at IS NULL OR expires_at > now())
  );
$$ LANGUAGE SQL STABLE;

-- 20260603_compliance_audit.sql
CREATE TABLE public.compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN (
    'contact_blocked_no_source',
    'contact_blocked_suppressed',
    'caption_blocked_no_disclosure',
    'contact_imported_with_source',
    'suppression_added',
    'suppression_removed',
    'gdpr_export_requested',
    'gdpr_delete_requested',
    'unsubscribe_processed'
  )),
  target_type TEXT,
  target_id UUID,
  details JSONB,
  triggered_by UUID REFERENCES auth.users(id),
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_compliance_audit_action ON compliance_audit_log(action, occurred_at DESC);
CREATE INDEX idx_compliance_audit_target ON compliance_audit_log(target_type, target_id);

FICHIERS À CRÉER/MODIFIER
==========================

Lib core compliance :
- lib/admin/compliance/suppression-check.ts (4-way check function)
- lib/admin/compliance/disclosure-checker.ts (FTC compliance)
- lib/admin/compliance/provenance-enforcer.ts (NO source = NO contact)
- lib/admin/compliance/audit-logger.ts (log all actions)
- lib/admin/compliance/contact-validator.ts (master validation)

UI Compliance Dashboard :
- app/(dashboard)/admin/compliance/page.tsx (overview)
- app/(dashboard)/admin/compliance/_components/suppression-stats.tsx
- app/(dashboard)/admin/compliance/_components/audit-log-viewer.tsx
- app/(dashboard)/admin/compliance/_components/recent-blocks.tsx
- app/(dashboard)/admin/compliance/_components/gdpr-requests.tsx

APIs :
- app/api/admin/compliance/check/route.ts (validate a contact before action)
- app/api/admin/compliance/audit/route.ts (audit log query)
- app/api/admin/compliance/gdpr-export/[email]/route.ts (RGPD data export)
- app/api/admin/compliance/gdpr-delete/[email]/route.ts (RGPD deletion)

Update existing :
- lib/admin/check-suppression.ts (call new 4-way function)
- app/api/admin/webhooks/instantly/route.ts (auto-add 4 dimensions on bounce/unsub)
- app/api/admin/influencers/import/route.ts (use master validation)

MASTER VALIDATION FUNCTION
==========================

// lib/admin/compliance/contact-validator.ts

export type ContactValidationResult = {
  allowed: boolean
  blocks: string[]  // List of reasons why blocked
  warnings: string[]
}

export async function validateContact(params: {
  email?: string
  handle?: string
  platform?: string
  profile_url?: string
  source_url?: string  // ⭐ Required for any contact attempt
  intent: 'import' | 'export_campaign' | 'send_email' | 'add_to_kit'
}): Promise<ContactValidationResult> {
  const blocks: string[] = []
  const warnings: string[] = []
  
  // Rule 1: NO source_url = NO contact (provenance required)
  if (params.intent !== 'import' && !params.source_url) {
    blocks.push('No source_url provided — cannot contact without provenance')
  }
  
  // Rule 2: 4-way suppression check
  const isSuppressed = await db.rpc('is_suppressed_4way', {
    p_email: params.email,
    p_handle: params.handle,
    p_profile_url: params.profile_url,
    p_platform: params.platform
  })
  if (isSuppressed) {
    blocks.push('Contact is in suppression list')
  }
  
  // Rule 3: For 'send_email' intent, email must exist
  if (params.intent === 'send_email' && !params.email) {
    blocks.push('No public email — cannot cold email')
  }
  
  // Log all blocks for audit
  if (blocks.length > 0) {
    await logComplianceBlock(params, blocks)
  }
  
  return {
    allowed: blocks.length === 0,
    blocks,
    warnings
  }
}

FTC DISCLOSURE CHECKER
======================

// lib/admin/compliance/disclosure-checker.ts

const DISCLOSURE_KEYWORDS = [
  '#ad',
  '#sponsored',
  'affiliate',
  'partner',
  'use my code',
  'use code',
  'i earn',
  'sponsorship',
  '#paidpartnership'
]

export function captionHasDisclosure(caption: string): boolean {
  const lower = caption.toLowerCase()
  return DISCLOSURE_KEYWORDS.some(kw => lower.includes(kw))
}

export function validateCaptionForKit(caption: string): {
  valid: boolean
  reason?: string
  suggestion?: string
} {
  if (!captionHasDisclosure(caption)) {
    return {
      valid: false,
      reason: 'Caption missing FTC disclosure',
      suggestion: 'Add #ad or "affiliate link" or "use code" at the beginning'
    }
  }
  return { valid: true }
}

// Block kit generation if no disclosure
export async function ensureCaptionCompliant(caption: string) {
  const result = validateCaptionForKit(caption)
  if (!result.valid) {
    await logComplianceBlock({ intent: 'add_to_kit' }, ['caption_blocked_no_disclosure'])
    throw new Error(`Caption non-compliant: ${result.reason}. Suggestion: ${result.suggestion}`)
  }
}

WEBHOOK UPDATES (auto-add 4 dimensions)
========================================

When Instantly webhook receives :
- email_bounced (hard) → add { email, email_domain } to suppression_list
- email_unsubscribed → add { email, email_domain } + try to detect handle/profile_url from CRM lookup
- email_complaint → add { email, email_domain } with severity flag

When Stripe webhook receives :
- charge.dispute.created → flag the user_id for review (potential fraud affiliate)

COMPLIANCE DASHBOARD
====================

UI : /dashboard/admin/compliance

Sections :
1. STATS HEADER
   - Total suppressed (with breakdown by reason)
   - Blocks today / this week
   - GDPR requests pending

2. RECENT BLOCKS
   Table : timestamp | action | target | reason | triggered_by

3. SUPPRESSION SOURCES
   Pie chart : auto-bounce / auto-unsub / manual / GDPR / complaint / fraud

4. AUDIT LOG
   Full searchable audit log avec filters

5. GDPR REQUESTS
   - Pending data exports
   - Pending deletions
   - Actions : approve / process / decline

DEFINITION OF DONE
==================
- [ ] Migration suppression_list extended apply
- [ ] is_suppressed_4way function créée
- [ ] compliance_audit_log table créée
- [ ] validateContact() master function build
- [ ] FTC disclosure checker fonctionnel
- [ ] All existing imports use new validation
- [ ] Webhooks (Instantly) auto-add 4 dimensions on bounce/unsub
- [ ] /dashboard/admin/compliance accessible
- [ ] Audit log query API
- [ ] GDPR export/delete APIs fonctionnels
- [ ] SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md updated avec V3 changes

ANTI-PATTERNS
=============
❌ Ne PAS bypass validateContact() pour "performance" (sécurité > vitesse)
❌ Ne PAS oublier de logger les blocks (audit trail)
❌ Ne PAS expose ip_address raw (use ip_hash)
❌ Ne PAS auto-delete sans confirmation manuelle (GDPR)
❌ Ne PAS send sans disclosure check
❌ Ne PAS oublier les warnings dans le résultat de validation

OUTPUT FINAL
============
Update SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md avec :
- V3 architecture
- 4-way suppression details
- FTC disclosure rules
- Provenance enforcement
- Master validator API
- Webhook auto-actions
- Compliance dashboard layout
- Audit log usage
```

---

## 📋 Ordre d'exécution

### Lance les 3 prompts EN PARALLÈLE
Aucun conflit entre eux (différentes parties du code) :
- 🟢 **V3-1A** — Scraper Core (CRM + scraper page + APIs)
- 🟣 **V3-1B** — Repost Kit (partner/repost public)
- 🔵 **V3-1C** — Compliance Layer (lib + dashboard admin)

### Durée estimée : 3-5h en parallèle

### Merge order final
1. V3-1C (Compliance — foundation pour les autres)
2. V3-1A (Scraper — utilise compliance)
3. V3-1B (Repost Kit — autonome)

---

## ✅ Definition of Done — Semaine 1 globale

- [ ] 12+ nouvelles tables Supabase apply
- [ ] Page `/dashboard/admin/scraper` fonctionnelle avec YouTube
- [ ] 1000+ leads YouTube découverts avec source_url tracké
- [ ] Page `/partner/repost/[handle]` mobile-first avec tracking 10+ events
- [ ] 4-way suppression check enforced partout
- [ ] FTC disclosure checker actif
- [ ] Page `/dashboard/admin/compliance` accessible
- [ ] 3 SYSTEM-REFERENCE docs créés/updated
- [ ] npm run build passe sans erreur
- [ ] Tests fonctionnels passent

---

*Document créé : 13 mai 2026*
*Pré-requis : Master Plan V3 reviewed par ChatGPT*
*Output attendu : Semaine 1 complete (1/6 du build V3)*
