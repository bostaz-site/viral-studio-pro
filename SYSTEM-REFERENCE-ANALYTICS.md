# SYSTEM REFERENCE — Analytics Page (v4 — Learning Engine)

> Ce fichier est la source de verite pour la page Analytics.
> Refonte complete : remplacement du dashboard dopamine par un Learning Engine.

---

## Philosophie

**Analytics is not a vanity dashboard. Analytics is the Learning Engine of Viral Animal.**

Its job is to:
1. Collect real performance data from connected social accounts (when APIs approved)
2. Detect which clip patterns perform or underperform per account and per platform
3. Feed those learnings back into the Smart Queue Engine so Distribution improves automatically

Analytics tells Distribution how to post better.

### Ce qui a ete SUPPRIME (v3 -> v4)
- Rank Hero (score counter, XP bar, radial gradient backgrounds)
- Daily Quest
- Missed Views (fake projections)
- Next Breakout Prediction (fake)
- Achievements / badges / milestones
- Dopamine layer (future projection, loss engine, urgency)
- Projected views
- Momentum score (remplace par confidence level du learning)
- Quick Stats (views, avg score, momentum)

### Ce qui est GARDE
- Creator Score + Creator Rank (YouTube) — affiche dans Account Breakdown, WIRED_REAL
- Total clips published + streak — petits badges dans le Learning Summary header

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/dashboard/analytics/page.tsx` | Page wrapper (Suspense + metadata + skeleton fallback) |
| `components/analytics/analytics-dashboard.tsx` | Composant principal (~420 lignes) — Learning Engine UI |
| `types/learning.ts` | Types Learning Engine : `ConfidenceLevel`, `PublishedPostPerformance`, `LearnedDistributionProfile`, helpers |
| `stores/account-store.ts` | Store existant (Creator Rank, YouTube stats, fetchAccountScore) |
| `lib/distribution/session-persistence.ts` | Stats persistantes localStorage (totalClipsPublished, streak) |
| `lib/scoring/account-scorer.ts` | Creator rank scoring + CREATOR_RANK_CONFIG |

### Fichiers NON utilises (mais pas supprimes)
- `lib/analytics/analytics-engine.ts` — ancien breakout/missed/quest (plus importe)
- `lib/scoring/momentum-scorer.ts` — ancien momentum (plus importe)
- `lib/distribution/reward-engine.ts` — milestones/streaks (plus importe)

---

## Layout (top to bottom)

```
1. Learning Summary (sticky header, bg-zinc-900/50 backdrop-blur)
   |- System learning message (N connected accounts)
   |- Clips published count + streak badge (si >= 3)
   |- Confidence badge (none/collecting/early/medium/high)
   |- Posts count + Last sync time

2. [Conditional] No Accounts CTA — full-width card "Connect your accounts" -> Settings
3. [Conditional] No Posts CTA — full-width card "Publish your first clip" -> Distribution

4. What's Working (border-left emerald)
   |- Real insights quand 5+ posts dans un pattern
   |- Locked/greyed example cards quand pas assez de data
   |- 3 exemples locked : TikTok funny, YouTube hype, Instagram short

5. What's Not Working (border-left red)
   |- Real insights quand 5+ posts dans un pattern
   |- Locked/greyed example cards quand pas assez de data
   |- 2 exemples locked : TikTok drama, YouTube long clips

6. Distribution Adjustments (border-left blue)
   |- Changements avec change/why/confidence
   |- Locked/greyed example cards quand pas assez de data
   |- 3 exemples locked : prioritize funny, shift posting window, enable word-pop

7. Account Breakdown (grid 1-3 colonnes)
   |- Card par compte connecte
   |- YouTube : Creator Score + Creator Rank (WIRED_REAL) + "Performance tracking coming soon"
   |- TikTok/Instagram : Lock icon + "Waiting for API approval"

8. Post History (table scrollable)
   |- Colonnes : Clip, Source, Score, Views (locked), Likes (locked), Posted
   |- Views/Likes affichent Lock icon + dash (API pas encore disponible)
   |- Refresh Stats button (disabled, "coming soon")
   |- Message footer : "Views and likes will appear when platform API tracking is approved"
```

---

## Confidence System

### Niveaux

| Posts | Level | Label | Badge style |
|---|---|---|---|
| 0 | `none` | No data | zinc-800/50, zinc-500 |
| 1-4 | `collecting` | Collecting signals | zinc-800/50, zinc-400 |
| 5-14 | `early` | Early signals | amber-500/10, amber-400 |
| 15-29 | `medium` | Medium confidence | blue-500/10, blue-400 |
| 30+ | `high` | High confidence | emerald-500/10, emerald-400 |

### Regles strictes
- 0 posts = "No data yet"
- 1-4 posts = "Collecting signals" (aucune conclusion)
- 5-14 posts = "Early signals" (insights provisoires seulement)
- 15-29 posts = "Medium confidence"
- 30+ posts = "High confidence"
- Ne JAMAIS dire "this works" ou afficher un multiplier avant 5 posts minimum dans le pattern concerne

### Source de verite
`types/learning.ts` : `getConfidenceLevel(postCount)`, `getConfidenceLabel(level)`, `getMinPostsForInsight()`

---

## Locked / Coming Soon Cards

### Design
- `opacity-40` sur la Card entiere
- `border-dashed` sur la Card
- `border-l-4` avec couleur de section (emerald/red/blue)
- `blur-[1px]` sur le contenu
- Lock icon centre en overlay (z-10)
- Texte `"Example insight:"` en italic, text-[10px], text-muted-foreground/80
- Message footer : `"Coming soon — Publish clips and connect accounts to see real insights"`
- Visuellement TRES different du contenu reel

### Exemples affiches

**What's Working (3 locked cards):**
- TikTok - Funny clips posted 7-10 PM — 2.4x above average (18 posts)
- YouTube Shorts - Hype clips with word-pop captions — 1.8x (12 posts)
- Instagram Reels - Short clips under 30s — 1.6x (9 posts)

**What's Not Working (2 locked cards):**
- TikTok - Drama clips posted mornings — -0.6x (7 posts)
- YouTube Shorts - Clips over 50s without hook — -0.4x (5 posts)

**Adjustments (3 locked cards):**
- Change: Prioritize funny/hype clips on TikTok — Why: 2.1x above average — Medium
- Change: Shift posting window to 7-10 PM — Why: 1.8x more viewers — Early
- Change: Enable word-pop captions by default — Why: +40% retention — Medium

---

## Account Breakdown Cards

### YouTube (connecte, WIRED_REAL)
- Platform icon gradient (red)
- @username
- Creator Score (numerique)
- Creator Rank (label)
- "Performance tracking coming soon" avec Lock icon

### TikTok / Instagram (connecte, pas de tracking API)
- Platform icon gradient
- @username
- Lock icon centre
- "Performance tracking coming soon"
- "Waiting for [Platform] API approval"

### Pas connecte
- Message dans la section : "No accounts connected. Connect in Settings"

---

## Post History Table

### Colonnes

| Colonne | Source | Status |
|---|---|---|
| Clip | render_jobs + trending_clips | WIRED_REAL |
| Source | render_jobs.source | WIRED_REAL |
| Score | trending_clips.velocity_score | WIRED_REAL |
| Views | PublishedPostPerformance.views | LOCKED (Lock icon + dash) |
| Likes | PublishedPostPerformance.likes | LOCKED (Lock icon + dash) |
| Posted | render_jobs.created_at | WIRED_REAL |

### Limites
- 50 clips max fetchees, 20 affiches
- "Showing 20 of N clips" footer si > 20
- Refresh Stats button desactive (API tracking pas encore available)

---

## Types (`types/learning.ts`)

### ConfidenceLevel
`'none' | 'collecting' | 'early' | 'medium' | 'high'`

### PublishedPostPerformance
Represente un clip publie avec ses metriques. Les champs `views`, `likes`, `comments`, `shares` sont `number | null` — null tant que l'API tracking n'est pas approuvee.

### LearnedDistributionProfile
Profil appris par le systeme : meilleurs moods par plateforme, meilleures fenetres de publication, meilleurs styles de caption, patterns sous-performants, ajustements. Sera genere quand le tracking reel sera disponible.

### AccountBreakdown
Card par compte : platform, username, postsAnalyzed, bestMood, bestTime, bestFormat, avoid, confidence, hasApiTracking, creatorScore (YouTube only).

---

## Data Sources

### WIRED_REAL
| Donnee | Source | Section |
|---|---|---|
| Connected accounts | GET /api/social-accounts | Learning Summary, Account Breakdown |
| Creator Score + Rank (YouTube) | account-store -> YouTube API | Account Breakdown |
| Total clips published | localStorage (session-persistence) | Learning Summary |
| Current streak | localStorage (session-persistence) | Learning Summary |
| Post history (clips) | render_jobs + trending_clips (Supabase) | Post History |

### LOCKED (Coming Soon)
| Donnee | Raison | Section |
|---|---|---|
| Views/Likes/Comments/Shares | API tracking pas encore approuve | Post History |
| What's Working insights | Pas assez de data / pas de tracking API | What's Working |
| What's Not Working insights | Pas assez de data / pas de tracking API | What's Not Working |
| Distribution Adjustments | Pas assez de data | Adjustments |
| TikTok/Instagram performance | API pas approuvee | Account Breakdown |

### PAS de fake
- Aucune donnee simulee presentee comme reelle
- Les exemples sont clairement locked (opacity-40, blur, lock icon, "Example insight" italic)
- Pas de faux multipliers, pas de faux views, pas de faux reach

---

## Statut par Feature

| Feature | Status |
|---|---|
| Learning Summary header | WIRED_REAL (comptes connectes + clips publies reels) |
| Confidence level | WIRED_LOCAL (base sur totalClipsPublished) |
| No Accounts CTA | WIRED_REAL (check social_accounts) |
| No Posts CTA | WIRED_LOCAL (check totalClipsPublished) |
| What's Working (real insights) | NOT_IMPLEMENTED (locked cards seulement) |
| What's Not Working (real insights) | NOT_IMPLEMENTED (locked cards seulement) |
| Distribution Adjustments (real) | NOT_IMPLEMENTED (locked cards seulement) |
| Locked example cards (all sections) | WIRED_REAL (visuellement distinct) |
| Account Breakdown (YouTube) | WIRED_REAL (Creator Score + Rank via YouTube API) |
| Account Breakdown (TikTok/Instagram) | NOT_IMPLEMENTED (lock + "waiting for API") |
| Post History table | WIRED_REAL (render_jobs + trending_clips) |
| Post History views/likes columns | LOCKED (API tracking coming soon) |
| Refresh Stats button | NOT_IMPLEMENTED (disabled) |

---

## Axes d'amelioration (post v4)

1. **API tracking reel** — TikTok/YouTube/Instagram APIs pour vraies metriques post (views, likes, comments)
2. **Pattern detection** — Quand tracking est live : detecter patterns (mood + timing + platform) avec 5+ posts
3. **Distribution feed** — Nourrir `LearnedDistributionProfile` dans le Smart Queue Engine
4. **Refresh flow** — Activer le bouton "Refresh stats" quand au moins 1 API tracking est approuvee
5. **Post metadata** — Enregistrer mood/caption_style/hook_style au moment du publish pour analysis
6. **Supabase table** — Creer table `published_posts` pour persister les performances (actuellement rien)
7. **A/B testing insights** — Comparer les variants (high-ctr vs safe-reach vs viral-bait) avec vrais resultats
