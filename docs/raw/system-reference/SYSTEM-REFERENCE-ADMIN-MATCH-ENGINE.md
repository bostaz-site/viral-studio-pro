# SYSTEM REFERENCE — Match Engine (V3-2C, v1.1)

> Rule-based V1 match algorithm: assigns the best promo video to each scored influencer.
> No ML — pure rule-based scoring (niche + audience + language + hook + lead boost).

---

## Architecture

### Library

| File | Description |
|---|---|
| `lib/admin/match-engine/scorer.ts` | Core: `computeMatchScore(video, influencer)` -> 0-100 |
| `lib/admin/match-engine/niche-matcher.ts` | Niche intersection with group expansion |
| `lib/admin/match-engine/audience-matcher.ts` | Audience size + language scoring |
| `lib/admin/match-engine/saturation-check.ts` | Max 100 assignments per video per 7 days |
| `lib/admin/match-engine/auto-assigner.ts` | Pick best non-saturated video, mark primary |

### API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/admin/match-engine/compute` | Compute matches (single or batch up to 200) |
| `GET` | `/api/admin/match-engine/compute?influencerId=X` | Get matches for an influencer |
| `POST` | `/api/admin/match-engine/override` | Manual admin override |
| `GET` | `/api/admin/match-engine/saturation` | Saturation stats per video |

### UI

| File | Description |
|---|---|
| `admin/match-engine/page.tsx` | Overview: stats + saturation + explorer + algorithm info |
| `_components/match-overview-stats.tsx` | KPI cards (matched/unmatched/fallbacks/overrides/avg) |
| `_components/saturation-monitor.tsx` | Per-video saturation bars with 100/week limit |
| `_components/match-explorer.tsx` | Search by influencer UUID, view all matches, override |

---

## Scoring Algorithm V1 (Rule-Based)

### 5 Factors — Total: 0-100

| # | Factor | Max Points | Source |
|---|---|---|---|
| 1 | **Niche Match** | 35 | Video niche tags vs influencer niche + tags (with group expansion) |
| 2 | **Audience Size Fit** | 25 | Influencer audience vs video target range |
| 3 | **Language Match** | 15 | Exact language match |
| 4 | **Hook Type Fit** | 15 | Video hook_type vs influencer content style affinities |
| 5 | **Lead Score Boost** | 10 | lead_score >= 80 → 10pts, >= 60 → 7pts, >= 40 → 4pts |

### Niche Matching Details

Niches are expanded via related groups:
- `gaming` expands to: gaming, fps, moba, esports, minecraft, valorant, fortnite, league
- `streaming` expands to: twitch, kick, irl, just_chatting, variety
- `tech` expands to: tech, ai, saas, productivity, apps, software

Each matched niche = 15 points, capped at 35 total.

### Audience Size Scoring

```
In target range (min-max): 25 points
Within 2x range: 15 points
Within 5x min: 5 points
Outside: 0 points
```

Default range: 1,000 - 1,000,000.

### Hook Type Affinities

| Hook Type | Affinities |
|---|---|
| tutorial | educator, how_to, productivity, tech, saas |
| transformation | before_after, fitness, business, growth |
| curiosity | mystery, storytelling, reveal, entertainment |
| social_proof | review, testimonial, comparison, apps |
| storytelling | irl, just_chatting, variety, entertainment |
| comparison | tech, review, apps, tools |
| shock | gaming, fps, entertainment, funny |

---

## Assignment Flow

```
1. Get influencer data (niche, tags, audience, language, lead_score)
2. Get all active promo_videos
3. Score each video against this influencer
4. Sort by score DESC
5. For each candidate (top first):
   a. Check saturation (< 100 assignments in 7 days?)
   b. If not saturated AND score >= 50 → assign as primary
   c. If saturated → skip, try next
6. If no match >= 50 → fallback to generic video
7. Clear old primary match, upsert new one
8. Log assignment for saturation tracking
9. Match expires after 14 days (re-compute)
```

---

## Saturation Strategy

- **Max**: 100 assignments per video per 7-day sliding window
- **Why**: TikTok/YouTube algorithms penalize identical content reposted by hundreds of accounts simultaneously
- **Monitor**: Visual progress bars in admin UI (green < 70, orange 70-99, red = saturated)
- **Enforcement**: Checked before every assignment — saturated videos are skipped

---

## Fallback

When no video scores >= 50 for an influencer:
1. Assign the generic video (a video with empty niche tags, tagged as universal)
2. Mark `is_admin_override = false`
3. Visible in admin UI as "fallback" count

---

## Admin Override

- Admin can manually set any video as primary for any influencer
- Sets `is_admin_override = true`, `match_score = 100`
- Override persists until manually changed (no expiry)
- Logs assignment for saturation tracking (overrides still count toward the 100 limit)

---

## Database

### Table: `video_influencer_matches`

Migration: `supabase/migrations/20260615_match_engine.sql`

| Column | Type | Description |
|---|---|---|
| id | UUID PK | |
| influencer_id | UUID FK | Target influencer |
| promo_video_id | UUID FK | Matched video |
| match_score | NUMERIC(5,2) | 0-100 score |
| match_breakdown | JSONB | `{niche, audience, language, hook_fit, lead_boost}` |
| is_primary | BOOLEAN | TRUE = currently assigned video |
| is_admin_override | BOOLEAN | TRUE = manually set by admin |
| computed_at | TIMESTAMPTZ | When score was computed |
| expires_at | TIMESTAMPTZ | Re-compute after this (14 days) |

UNIQUE constraint on `(influencer_id, promo_video_id)`.

### Table: `video_assignment_log`

Append-only log for saturation tracking.

| Column | Type | Description |
|---|---|---|
| id | UUID PK | |
| promo_video_id | UUID FK | |
| influencer_id | UUID FK | |
| assigned_at | TIMESTAMPTZ | When assigned |
| email_sent_at | TIMESTAMPTZ | When outreach email was sent |
| posted_at | TIMESTAMPTZ | When creator posted (from repost kit) |

---

## Sidebar

Added "Match Engine" (Cpu icon) to admin navigation in `layout.tsx`.

---

## Anti-Patterns Avoided

- No ML V1 (rule-based is transparent and debuggable)
- No full recompute on every update (incremental per influencer)
- Saturation enforced (100/video/week max)
- No auto-assign below score 50 (fallback to generic)
- Breakdown always stored (transparency = trust)
- Admin override never blocked

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **AI-SCORING** | Les leads scorés (lead_score 0-100) alimentent le facteur #5 Lead Score Boost |
| **VIDEO-LIBRARY** | Source des `promo_videos` matchées — le match engine ne crée pas de vidéos |
| **OFFER-GENERATOR** | Consomme le match primaire (`is_primary = true`) pour personnaliser l'offre email |
| **REPOST-KIT** | Le champ `posted_at` dans `video_assignment_log` est rempli lors du submit du repost kit |

---

## V2 planifiee (post-donnees)

> Activable uniquement après accumulation de données réelles (reposts, conversions, saturation observée).

### Nouveau facteur : `activation_fit` (25 pts)

Mesure la probabilité qu'un influenceur reposte réellement la vidéo assignée, basée sur :
- Historique de reposts passés (taux de conversion assign → post)
- Temps moyen entre assignation et repost
- Taux d'ouverture/clic des emails du même profil

### Saturation par `creative_family`

Remplace la saturation brute (100/vidéo/semaine) par une saturation par famille créative :
- **Cap réaliste** : 40-60 posts réels par famille par semaine (basé sur données observées)
- Plusieurs vidéos peuvent appartenir à la même famille (même hook, même angle)

### Caps sur posts reels

En plus du cap d'assignations (100/vidéo/semaine), ajouter un cap sur les posts réels :
- **15-25 posts réels par vidéo par semaine** (à calibrer avec données)
- Empêche qu'un même contenu sature l'algorithme TikTok/YouTube

> **Note** : 0 vidéos actuellement en bibliothèque — voir PLAN-VIDEOS-PROMO côté founder avant d'activer V2.

---

*Document version 1.1 — Juillet 2026*
*Branch: feature/acquisition-v3-match-engine*
