# 🕷️ SCRAPER INFLUENCEURS CUSTOM — Prompt Claude Code

> Build un scraper custom dans `/dashboard/admin/scraper` au lieu d'utiliser Apify.
> Sources : Twitch (Helix API), Kick (officielle), YouTube (Data API v3), TikTok (yt-dlp).
> Durée estimée : 3-4h.

---

## 🎯 PROMPT À COPY-PASTE DANS CLAUDE CODE

```
CONTEXTE
========
Tu travailles sur Viral Animal (https://viralanimal.com), Next.js 14 + Supabase + Stripe.
L'admin hub est LIVE en prod avec CRM influenceurs complet.

Maintenant on veut SCALER les leads sans payer Apify ($50/mois).
On build notre propre scraper dans /dashboard/admin/scraper.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-scraper (ou continuer sur master selon préférence)

DOCS À LIRE EN PREMIER
=======================
1. ADMIN-MEGA-PLAN.md v2.1 — Module 2 (Influencer CRM)
2. ADMIN-DATABASE-SCHEMA.md — Table influencers, import_batches, lead_enrichment_snapshots
3. SYSTEM-REFERENCE-ADMIN-CRM.md — Pattern import CSV existant
4. SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md — Pour comprendre le flow next

TÂCHE
=====
1. Page /dashboard/admin/scraper avec UI complète
2. Backend : 4 scrapers (Twitch, Kick, YouTube, TikTok)
3. Filtres avancés (game, niche, audience, langue, pays, activité récente)
4. Preview liste avant import
5. Bulk import vers influencers table avec :
   - Dedup CITEXT email
   - Check suppression list
   - Tag automatique source ("scraped_twitch_gaming")
6. Save searches (pour relancer les mêmes scrapes)
7. Track quota usage par API
8. Enrichissement via lead_enrichment_snapshots

ARCHITECTURE
============
UI : /dashboard/admin/scraper
- Tab par plateforme (Twitch/Kick/YouTube/TikTok)
- Form filtres
- Preview table (50-500 résultats)
- Bulk select + Import button

Backend :
- lib/admin/scraper/twitch.ts (Helix API client)
- lib/admin/scraper/kick.ts (Kick API client)
- lib/admin/scraper/youtube.ts (Data API v3 — déjà setup)
- lib/admin/scraper/tiktok.ts (yt-dlp wrapper pour profils publics)
- lib/admin/scraper/import.ts (bulk import logic avec dedup + suppression)
- lib/admin/scraper/save-search.ts (sauvegarder configs)
- app/api/admin/scraper/[platform]/route.ts (4 routes)
- app/api/admin/scraper/import/route.ts (bulk import)
- app/api/admin/scraper/saved-searches/route.ts (CRUD)
- supabase/migrations/20260601_scraper_tables.sql

MIGRATION supabase
==================
CREATE TABLE public.scraper_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitch', 'kick', 'youtube', 'tiktok')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_result_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.scraper_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  api_name TEXT NOT NULL,
  calls_count INTEGER NOT NULL DEFAULT 0,
  quota_limit INTEGER,
  usage_date DATE NOT NULL,
  reset_at TIMESTAMPTZ,
  UNIQUE (platform, api_name, usage_date)
);

CREATE INDEX idx_scraper_quota_date ON scraper_quota_usage(usage_date DESC, platform);

TWITCH SCRAPER (le plus important)
====================================
API : Twitch Helix API
Auth : OAuth Client Credentials Flow

ENV VARS À AJOUTER :
- TWITCH_CLIENT_ID (déjà existant probablement, sinon créer app dev.twitch.tv)
- TWITCH_CLIENT_SECRET (pareil)

Endpoints à utiliser :
- GET /helix/games (search game by name → game_id)
- GET /helix/streams?game_id={id}&first=100 (top streamers per game)
- GET /helix/users?id={id} (user info — language, view_count)
- GET /helix/channels/followers?broadcaster_id={id}&first=1 (follower count via header)

Filtres supportés :
- Game (search dropdown)
- Audience size min/max
- Language (en, fr, es, etc.)
- Currently live OR ever streamed
- Min stream count last 30 days (need to check API)

Logique scrape :
1. User entre filtres
2. Si game spécifié : search game_id via /helix/games
3. Get /helix/streams pour ce game (sorted by viewer_count DESC)
4. Pour chaque streamer trouvé, fetch user details
5. Estimer email via patterns courants :
   - {username}@gmail.com (likely)
   - business@{username}.com (less common)
   - {real_name}@gmail.com si disponible
6. Retourner liste avec : username, display_name, language, viewer_count, profile_image, estimated_email, stream_url

⚠️ EMAIL ESTIMATION :
Twitch ne donne pas l'email directement (privacy). On peut :
- Estimer via patterns courants
- Marquer email_verified=false sur l'influencer
- Plus tard, enrichir via Hunter.io ou similar (paid)
- OU envoyer DM Twitch d'abord (manual outreach)

Pour l'instant, on retourne juste le profil Twitch sans email. Tag l'influencer "needs_email_lookup".

KICK SCRAPER
============
API : Kick API officielle (récente, en bêta)
Auth : OAuth (à setup)

Endpoints similaires à Twitch.

YOUTUBE SCRAPER
================
API : YouTube Data API v3 (déjà setup)
ENV : YOUTUBE_API_KEY (probablement déjà existant)

Endpoints :
- GET /youtube/v3/search?q={niche}&type=channel
- GET /youtube/v3/channels?id={id}&part=statistics,snippet

Filtres :
- Niche (gaming, tech, beauty, etc.)
- Subscriber count min/max
- Country
- Language
- Active last 90 days (via search by date)

Email : Pas dispo directement. Les channels ont parfois "Business email" public — à scraper depuis la page channel.

TIKTOK SCRAPER (le plus tricky)
================================
TikTok n'a PAS d'API officielle de discovery (juste Display + Direct Post pour les apps).
On utilise yt-dlp pour scraper les profils publics.

Approche :
- yt-dlp peut lister les vidéos d'un user TikTok
- Mais pour DÉCOUVRIR des users, on doit utiliser des hashtags ou trending

Alternative simple : User entre une liste de TikTok handles (par nom), on enrichit chacun.

Ou : laisser TikTok scraper comme V2 (plus complexe).

Pour V1 : Skip TikTok ou mode manuel ("entre handles, on enrichit").

UI /dashboard/admin/scraper
============================

Tabs en haut : Twitch / Kick / YouTube / TikTok
Pour chaque tab :

**Form filtres** (varies per plateforme) :
- Game/Niche search input
- Audience size : min slider + max slider
- Language dropdown
- Country dropdown
- "Active last X days" toggle

**Saved searches** dropdown : load configs sauvegardées

**Action buttons** :
- "Search" → trigger API call
- "Save as preset" → save dans scraper_saved_searches

**Loading state** : "Searching... [12/100 fetched]"

**Results table** :
- Checkbox bulk select
- Avatar | Display name | Username | Audience | Language | Activity | Action
- Pagination si > 50 résultats
- Filter results post-search (search by name)

**Action buttons sous résultats** :
- "Select all" / "Select 50 with highest score"
- "Import selected to CRM" → POST /api/admin/scraper/import
- "Export as CSV"

**Quota panel** :
- "Twitch API: 4,832 / 50,000 calls today"
- "YouTube quota: 1,200 / 10,000 daily quota"
- Refresh status

IMPORT FLOW
===========
POST /api/admin/scraper/import
Body : { platform, leads: [{ username, display_name, audience_size, language, ... }] }

Process :
1. Auth check (requireAdminRole('manage_crm'))
2. Create import_batches row avec source='scraper_twitch' (ou autre)
3. Pour chaque lead :
   a. Si email présent : check suppression_list
   b. Check dedup via CITEXT email OR username + platform
   c. INSERT INTO influencers avec :
      - platform_handle
      - audience_size
      - language
      - source = 'scraper_{platform}'
      - tags = ['scraped', '{niche}']
      - status = 'unqualified' (à reviewer manuellement)
   d. INSERT lead_enrichment_snapshots avec raw_data
   e. Si pas d'email : marquer email_verified=false
4. Mark batch completed avec stats
5. Return summary

QUOTA TRACKING
==============
Chaque API call → INSERT/UPDATE dans scraper_quota_usage.
Hard limit dans le code pour ne pas dépasser :
- Twitch : 800 requests / minute (mais soft limit 50k/jour pour safety)
- YouTube : 10,000 quota points / jour (search = 100 points, channel = 1 point)
- Kick : à vérifier (probablement similaire à Twitch)

Si limit atteint → return erreur + suggestion d'attendre

ANTI-PATTERNS
=============
❌ Ne pas hammerer les APIs (rate limit côté serveur)
❌ Ne pas sauvegarder les emails inventés/devinés sans flag (false-positive risk)
❌ Ne pas importer sans suppression check
❌ Ne pas oublier le tag 'scraped_via_X' pour distinguer des imports CSV manuels
❌ Ne pas exposer TWITCH_CLIENT_SECRET côté client
❌ Ne PAS auto-send cold email aux leads juste scraped (manual review first)

DEFINITION OF DONE
==================
- [ ] Migration scraper_saved_searches + scraper_quota_usage apply
- [ ] Page /dashboard/admin/scraper accessible
- [ ] Tab Twitch fonctionne (recherche par game, retourne streamers)
- [ ] Tab YouTube fonctionne (recherche par niche, retourne channels)
- [ ] Tab Kick fonctionne (OU placeholder "Coming soon")
- [ ] Tab TikTok fonctionne (mode handles manuels) OU placeholder
- [ ] Preview results table avec bulk select
- [ ] Import vers CRM avec dedup + suppression check
- [ ] Quota tracking fonctionne
- [ ] Save search fonctionne
- [ ] SYSTEM-REFERENCE-ADMIN-SCRAPER.md créé

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-SCRAPER.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 📋 Comment utiliser

1. **Copy le bloc** entre les ```
2. **Ouvre une nouvelle session Claude Code**
3. **Colle le prompt**
4. Laisse-le tourner ~3-4h

---

## ⚠️ Pré-requis avant de lancer

### ENV VARS Twitch
Tu as déjà :
- `TWITCH_CLIENT_ID` ✅
- `TWITCH_CLIENT_SECRET` ✅

(Tu utilises déjà Twitch pour importer les clips users.)

### ENV VAR YouTube
Tu as déjà :
- `YOUTUBE_API_KEY` ✅

### Kick (à setup)
Tu devras peut-être créer une app Kick API. Si Kick n'est pas ready, le prompt va le laisser "Coming soon".

---

## 🎯 Ce que ça va débloquer

Une fois buildé, tu pourras en **2 min** :
- Trouver 100 streamers gaming Twitch >10k followers
- Tous les importer dans ton CRM
- Lancer une campagne ciblée

**Au lieu de** :
- Aller manuellement sur Twitch directory
- Copier-coller 100 fois
- Importer un CSV
- = 2-3h de travail

**Économie** : $50/mois (Apify) + des heures par semaine.

---

## ⚡ Lance le prompt et c'est parti

Tu lances la session Claude Code maintenant ?
