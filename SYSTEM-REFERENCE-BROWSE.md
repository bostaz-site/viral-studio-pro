# SYSTEM REFERENCE — Browse / Trending Page (v3.0 — Loot Feed Overhaul)

> Ce fichier est la source de verite pour la page Browse (Dashboard principal).
> Derniere mise a jour : 2026-07-02 — master tier removed, 3 visual tiers, daily radar, top pick hero, decluttered cards.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` | Page principale (~660 lignes) — header, feed tabs, upload, grid, quick export, notifications |
| `components/trending/trending-card.tsx` | Carte clip (~590 lignes) — thumbnail, hover video preview, rank frames, signal tags, CTA |
| `components/trending/trending-filters.tsx` | Barre de filtres — search, sort toggle, platform/duration/niche pills |
| `components/trending/trending-detail-modal.tsx` | Modale detail — stats grid, sparkline, score breakdown, feed category badge |
| `components/trending/rank-badge.tsx` | SVG decoratifs — `getRankTierClass()`, `DiamondCorner` (MasterCorner/Crown/Skull retained but unused) |
| `components/trending/remix-card.tsx` | Carte remix — status badge, download, compare, re-edit |
| `components/trending/remix-progress.tsx` | Overlay progression remix — 5 steps simules, progress bar |
| `components/trending/export-ticker.tsx` | Social proof live — Supabase Realtime broadcast "new_export" |
| `components/trending/sparkline.tsx` | Mini graph SVG — polyline views trend (vert=up, rouge=down) |
| `components/trending/velocity-badge.tsx` | Badge velocity — 4 tiers visuels (Viral, Hot, Rising, Slow) |
| `components/trending/trending-stats.tsx` | Panel stats — 6 StatCards + platform breakdown bar |
| `components/trending/notification-bell.tsx` | Cloche alertes — portal dropdown, clips velocity >= 80 |
| `stores/trending-store.ts` | Zustand store (~560 lignes) — clips, filtres, pagination, saved, bootstrap |
| `types/trending.ts` | Types — `TrendingClip`, `TrendingFiltersState`, `clipRank()`, `getClipInsight()` |
| `types/enums.ts` | Enums partages — `ClipRank`, `FeedCategory`, `ClipTier` |
| `lib/trending/constants.ts` | Constantes — `PLATFORM_STYLES`, `NICHE_LABELS` |
| `lib/trending/utils.ts` | Utilitaires — `formatCount()`, `timeAgo()` |
| `lib/browse/clip-verdict.ts` | Verdict contextuel, CTA dynamique, couleurs — remplace les phrases hardcodees |
| `lib/hooks/use-tilt.ts` | Hook 3D tilt — framer-motion springs, amplitude par rank |
| `app/rank-cards.css` | CSS rank cards — 3 tiers visuels (neutral, epic, legendary) + legendary 2 intensities |
| `app/api/trending/route.ts` | API GET/POST — filtrage, cursor pagination, stream grouping |
| `app/api/render/quick/route.ts` | API Quick Export — mood detection auto + render pipeline |
| `hooks/use-render-subscription.ts` | Supabase Realtime subscription + polling fallback |

---

## Layout (top to bottom)

```
1. FirstClipOverlay (onboarding, premiere visite)
2. ReferralBonusBanner (si referral actif)
3. Header — PageHeader (Compass icon, cyan accent)
   Title: "Browse Clips"
   Subtitle: "Pick a trending clip. We'll make it TikTok-ready."
   Right slot: [Upload clip (dashed outline)] [Refresh]
4. ExportTicker — social proof live "A creator just exported..." (Realtime)
5. Upload error card (si erreur upload)
6. Twitch refresh toast (si message apres import)
7. **DAILY RADAR** (E1) — 56px bandeau, radius 16px, border cyan/20, bg cyan/6, Radar icon
   "DAILY RADAR · {X} new clips since your last visit · {Y} fresh drops · {Z} legendary · Last scan: {N}m ago"
   - localStorage 'va-last-visit' (timestamp, updated on unmount)
   - Hidden on first-ever visit
   - Counts: clips where created_at > lastVisit; legendary = score >= 80
8. Feed tabs (segmented control) — dynamic tab count, left-to-right order:
   - **All Clips** (Compass, count) — DEFAULT, first position
   - Exploding Now (Flame) — **AUTO-HIDDEN when 0 clips** (D1). Reappears with content.
   - Proven Winners (Trophy, count) | Fresh Drops (Clock, count) | Saved (Bookmark, count)
   - Smart fallback: if default tab has 0 → auto-switch + fallback note
   - Fallback note: only shown on tabs that triggered fallback, NOT on Saved/All (D2)
   - Fallback copy: "No fresh explosions yet. Radar checks every 15 min — proven winners loaded."
9. TrendingFilters — compact bar
10. Error card (si erreur fetch)
11. **TOP PICK** — Royal compact card (`TopPickCard`), ~130px high, max-w-[680px]:
    - **Criteria**: `feed_category` in (early_gem, hot_now) + `velocity_score >= 75` + clip < 12h old
    - Layout: thumbnail 150x96 | chip + title + meta + insight | score 46px gold gradient + "Steal this clip →" CTA
    - **Legendary frame** (reuses `.leg-frame` / `.leg-frame-inner-border` / `.leg-frame-inner-gold`
      from rank-cards.css with `.tp-frame-full` full-radius variant)
    - **Ornaments**: GoldCrown SVG (64x46, faceted like gems — triangular kite prongs + faceted band,
      same tp-gc*/tp-gp* gradients), 4x TopPickGem SVG (24x28, corners)
    - **Score**: 46px, gold gradient, count-up 0→value in 800ms on mount, light sweep animation
      every 6s (tpScoreSweep, background-position on enlarged gradient). No "VIRAL SCORE" label.
      Hover: scale(1.04). THE only rest animation on the card.
    - **Hover sequence** (one-shot ~700ms, NOT infinite): gems glow 900ms → crown shine 700ms →
      score flash 400ms (180ms delay) → card translateY(-2px). Calm after.
    - Chip: discrete (#FDE68A text, rgba(245,158,11,.10) bg, amber border), NOT solid fill
    - Insight: grey text, flame icon in #F59E0B. Never duplicated with meta line.
    - prefers-reduced-motion: all animations disabled (score shows value directly)
    - Mobile (<540px): stacks vertically (thumb full-width h150, score+CTA inline)
    - Not shown on Saved tab or when no clip meets criteria
12. Content area (all clips in grid — top pick also appears in grid):
    ├── Loading → shimmer skeleton grid
    ├── Empty → tab-specific empty state
    └── Clips → TrendingCard grid (sm:2, lg:3, xl:4, 2xl:5 cols, gap-6)
    - Each card receives `isNew` prop (clip appeared since last visit)
13. Load more button
14. Quick Export / Render notifications
15. InstallBanner (PWA)
16. TrendingDetailModal
```

---

## Store (Zustand: `useTrendingStore`)

### State complet

```typescript
// Data
clips: TrendingClip[]               // Tous les clips charges depuis l'API
filteredClips: TrendingClip[]        // Clips apres filtrage + tri
megaViralClips: TrendingClip[]       // filteredClips ou rank === 'legendary'
trendingClips: TrendingClip[]        // filteredClips ou rank !== 'legendary'
stats: TrendingStats                 // Stats calculees a partir de clips[]

// Pagination (cursor-based)
cursor: string | null                // Format "{sortValue}_{id}" pour la prochaine page
hasMore: boolean                     // true si next_cursor !== null dans la reponse API
loadingMore: boolean                 // true pendant loadMore()
totalCount: number                   // count total depuis l'API (meta.total)

// Saved/Favorites
savedClipIds: Set<string>            // IDs des clips sauvegardes (pour highlight)
savedClips: SavedClip[]              // Objets complets des clips sauvegardes

// Stream grouping
expandedGroups: Set<string>          // IDs des stream groups expandus

// Bootstrap data (charge en parallele avec clips)
userPlan: string | null              // Plan utilisateur (free/pro/studio)
monthlyVideosUsed: number            // Videos utilisees ce mois
bonusVideos: number                  // Videos bonus (referral, etc.)
recentRemixes: BootstrapRemix[]      // 5 derniers remixes

// Filters
filters: TrendingFiltersState        // Etat complet des filtres (voir section Filters)

// UI
loading: boolean                     // true pendant le premier fetch
refreshing: boolean                  // true pendant un refresh silencieux
error: string | null                 // Message d'erreur si fetch echoue
autoRefreshEnabled: boolean          // Default true (pas utilise dans l'UI actuelle)
autoRefreshInterval: number          // Default 60_000ms
lastRefreshed: string | null         // ISO timestamp du dernier fetch reussi

// Notifications
notifications: ViralNotification[]   // Max 20 notifications (clips >= 80 apparus)
notificationsRead: boolean           // true si l'utilisateur a ouvert la cloche

// Internal
_searchDebounce: ReturnType<typeof setTimeout> | null  // Timer pour debounce search
```

### Actions

| Action | Declencheur | Comportement |
|---|---|---|
| `fetchClips(silent?)` | Mount + refresh + tab change + filtre change | Construit URLSearchParams (incl. feed), fetch limit=50, detecte nouveaux clips viraux pour notifications, triggers `fetchTabCounts()` |
| `fetchTabCounts()` | After fetchClips + mount | GET /api/trending/counts → tabCounts state (exploding, proven, fresh, all, legendary) |
| `loadMore()` | Bouton "Load more" | Append avec cursor (feed param inclus), deduplication par ID |
| `setFilters(filters)` | Changement de filtre UI | Search: debounce 300ms + client-side immediat. Autres: server re-fetch |
| `setFeed(feed)` | Clic tab feed | Resets cursor, triggers fetchClips() (server re-fetch with new feed) |
| `applyFilters()` | Apres fetch ou changement local | Pipeline: saved filter → streamer → sort → stream groups |
| `computeStats()` | Apres chaque fetch | Recalcule stats depuis clips[] (rankCounts, feed counts, platforms, games) |
| `fetchBootstrap()` | Mount (parallele avec fetchClips) | GET /api/bootstrap → saved IDs, remixes, profile |
| `fetchSavedClips()` | Apres toggleSaveClip pour re-sync | GET /api/clips/saved |
| `toggleSaveClip(id)` | Clic Bookmark | Optimistic update + POST/DELETE + rollback on error |
| `toggleGroup(groupId)` | Clic badge groupe | Toggle expandedGroups Set + reapply filters |
| `markNotificationsRead()` | Ouverture de la cloche | Set notificationsRead = true |

### `setFilters()` — Decision tree

```
search change → debounce 300ms → fetchClips(silent)
               + applyFilters() immediat (client-side pour responsiveness)

games/platforms/duration/sort change → fetchClips(silent) immediat

feed change → via setFeed() (pas setFilters)

autre (ex: reset) → applyFilters() seulement
```

### `setFeed()` — Decision tree

```
saved → fetchSavedClips() + applyFilters()
remixes → applyFilters() seulement

hot_now / proven / recent / all → reset cursor + fetchClips() (full server re-fetch with feed param)
```

### `fetchClips()` — Limit logic

```
Always limit=50 — server applies feed + other filters BEFORE pagination.
Feed param sent: hot_now, proven, recent (not sent for: all, saved, remixes).
```

---

## Types (`types/trending.ts`)

### TrendingClip

```typescript
interface TrendingClip {
  id: string
  external_url: string
  platform: string                    // 'twitch' | 'kick' | 'youtube_gaming'
  author_name: string | null
  author_handle: string | null
  title: string | null
  description: string | null
  niche: string | null                // 'irl', 'fps', 'moba', etc.
  view_count: number | null
  like_count: number | null
  velocity_score: number | null       // Score V2 final (0-100)
  thumbnail_url: string | null
  scraped_at: string | null
  created_at: string | null
  duration_seconds: number | null
  velocity: number | null             // Vues/heure brutes
  viral_ratio: number | null
  viral_score: number | null
  clip_created_at: string | null
  streamer_id: string | null
  twitch_clip_id: string | null
  tier: string | null                 // DB tier ('mega_viral', 'viral', etc.)

  // V2 sub-scores
  momentum_score: number | null
  engagement_score: number | null
  recency_score: number | null
  format_score: number | null
  saturation_score: number | null
  early_signal_score: number | null
  anomaly_score: number | null        // = authority_score (reutilise la colonne)
  feed_category: FeedCategory | null  // 'hot_now' | 'early_gem' | 'proven' | 'normal'

  // Optionnels
  prev_momentum_score?: number | null
  export_count?: number | null
  stream_group_id?: string | null        // Ajoute par API, pas en DB
  stream_group_count?: number | null
  stream_group_collapsed?: boolean
}
```

### Enums (types/enums.ts)

```typescript
ClipRank = 'common' | 'rare' | 'super_rare' | 'epic' | 'legendary' | 'master'
FeedCategory = 'hot_now' | 'early_gem' | 'proven' | 'normal'
ClipTier = 'mega_viral' | 'viral' | 'hot' | 'rising' | 'normal' | 'dead'
```

### clipRank(clip) — Derivation du rank depuis velocity_score

| Score | Rank |
|---|---|
| >= 95 | master |
| >= 80 | legendary |
| >= 65 | epic |
| >= 45 | super_rare |
| >= 25 | rare |
| < 25 | common |

Note : clipRank() ignore le champ `tier` de la DB et derive uniquement de `velocity_score`.

### getClipInsight(clip) — Insight contextuel

Retourne `{ icon: string; text: string } | null`. Premier match gagne:

| Condition | Icon | Text |
|---|---|---|
| momentum_score >= 65 | fire | High momentum |
| feed_category === 'early_gem' | gem | Early gem |
| early_signal_score >= 50 | zap | Spike detected |
| anomaly_score >= 70 | chart | Outperforms streamer avg |
| engagement_score >= 75 | heart | High engagement |
| format_score === 100 | target | Perfect format |

### TrendingFiltersState

```typescript
interface TrendingFiltersState {
  search: string              // Texte libre, debounce 300ms
  games: string[]             // Niches selectionnees (multi-select)
  platforms: string[]          // Plateformes selectionnees (multi-select)
  sort: 'velocity' | 'date'   // Tri principal
  duration: 'all' | 'short' | 'medium' | 'long'  // <30s | 30-60s | 60s+
  feed: FeedFilter             // Tab actif
}
```

### FeedFilter

```typescript
type FeedFilter = 'all' | 'hot_now' | 'early_gem' | 'proven' | 'recent' | 'saved' | 'remixes'
```

---

## Feed Category Tabs (Current State)

5 tabs visibles. Default: `all` (All Clips, sorted by velocity score). **Server-side filtering per tab.**

| Tab | Label UI | Icon | Style | Server filter | Count source |
|---|---|---|---|---|---|
| `all` | All Clips | Compass | Primary (DEFAULT, 1st) | No filter | `/api/trending/counts` → all |
| `hot_now` | Exploding Now | Flame | Primary | `feed_category IN ('early_gem','hot_now')` | `/api/trending/counts` → exploding |
| `proven` | Proven Winners | Trophy | Primary | `feed_category = 'proven'` | `/api/trending/counts` → proven |
| `recent` | Fresh Drops | Clock | Primary | `clip_created_at >= now - 24h` | `/api/trending/counts` → fresh |
| `saved` | Saved | Bookmark | Normal | Client-side (savedClipIds) | savedClipIds.size |

### Tab count — Single source of truth

- **`GET /api/trending/counts`** returns `{ exploding, proven, fresh, all, legendary }` via 5 parallel COUNT queries.
- Called on mount + after every `fetchClips()`.
- Tab badges, Daily Radar, and "Load more (N remaining)" all derive from these server counts.
- "Exploding Now" tab auto-hidden when `tabCounts.exploding === 0`.

### Tab switching — Server re-fetch

`setFeed(tab)` resets cursor + calls `fetchClips()` which sends `?feed={tab}` to the server.
The server applies the feed filter BEFORE pagination (`.limit(50)`).
"remaining" = `totalCount - filteredClips.length` (totalCount comes from `{ count: 'exact' }` on the filtered query).

### Empty states par tab

| Tab | Message (clips.length > 0) | Boutons |
|---|---|---|
| `hot_now` | "No clips exploding right now. Check Proven Winners or All Clips." | [Proven Winners] [All Clips] |
| `recent` | "No fresh drops in the last 6 hours. Check Proven Winners." | [Proven Winners] [All Clips] |
| `proven` | "No proven winners yet. Try All Clips." | — |
| `saved` | "You haven't saved any clips yet. Browse clips and tap the bookmark icon." | — |
| `all` | "Try refreshing — new clips drop every few minutes." | — |
| (clips.length === 0) | "Clips from Twitch & Kick will appear here once imported." | [Import Clips] |

### Saved tab flow

1. `setFeed('saved')` → calls `fetchSavedClips()`
2. `GET /api/clips/saved` returns saved rows with `trending_clips(*)` join
3. `savedTrendingClips[]` populated from the join data (full TrendingClip objects)
4. `applyFilters()` uses `savedTrendingClips` instead of filtering `clips` by ID
5. This ensures saved clips show even if they weren't in the current feed fetch

### Data fetch strategy

- Feed tabs ARE sent to the server as `?feed=` param for server-side filtering
- `fetchClips()` always requests `limit=50` — server filters before paginating
- Switching tabs triggers a full re-fetch with the new feed param
- Counts come from a dedicated `/api/trending/counts` endpoint (5 parallel COUNT queries)

---

## Filtres (TrendingFilters)

### Structure de la barre

```
Main row: [Search input (max-w-sm)] [Sort toggle: Score|Date] [Streamer dropdown "All streamers"] [More filters button] [Clear]

Collapsible panel (on "More filters" click):
  PLATFORM: [Twitch pill] [Kick pill]
  DURATION: [Short <30s] [Medium 30-60s] [Long 60s+]
  NICHE:    [IRL (50)] [FPS (23)] [MOBA (12)] ... (max 6 pills, sorted by count desc)
```

### Pills de filtre

| Type | Couleur active | Comportement |
|---|---|---|
| Platform (Twitch, Kick) | `bg-primary/10 text-primary border-primary/40` | Multi-select, toggle |
| Duration (Short, Medium, Long) | `bg-amber-500/10 text-amber-400 border-amber-500/30` | Single-select, re-click deselectionne |
| Niche (IRL, FPS, etc.) | `bg-indigo-500/15 text-indigo-400 border-indigo-500/30` | Multi-select, max 6 pills, tries par count desc |

### Niche pills dynamiques

Les niches affichees viennent de `availableNiches` (= `stats.games`), triees par count desc, limitees a `maxNichePills` (default 6). Chaque pill affiche le label formate et le count.

### Sort toggle

Deux options dans un segment control: `Algo Score` (sort=velocity) et `Date` (sort=date). Style: bg-primary quand actif.

### Filtrage — Server-side (all filters sent to API)

| Filtre | Server param | Comportement |
|---|---|---|
| Feed tab | `?feed=hot_now/proven/recent` | Applied BEFORE pagination. hot_now = IN(early_gem, hot_now). recent = 24h. |
| Search | `?search=` | Debounce 300ms, ilike on title/author_name/author_handle |
| Platform | `?platform=twitch,kick` | .eq or .in on platform column |
| Niche | `?niche=irl,fps` | .ilike single, .in multi |
| Duration | `?duration=short/medium/long` | lt/gte on duration_seconds |
| Sort | `?sort=velocity/date` | ORDER BY velocity_score or clip_created_at DESC |
| Streamer | (client-side only) | Applied in applyFilters() after fetch |
| Saved | (client-side only) | Uses savedClipIds Set, not sent to server |

### Count display

Quand `filteredCount !== totalCount`: affiche "Showing {filteredCount} of {totalCount} clips" sous les pills.

---

## TrendingCard — Systeme de cartes rang

### 4 Paths de rendu

Le composant `TrendingCard` a 2 paths de rendu principaux bases sur le rank:

1. **Legendary path** (score >= 80, < 95) — Rendu completement separe avec frame doree ornementale
2. **Default path** (neutral / epic / master) — Rendu partage avec variations CSS

Dans le default path, le meta section a 2 sous-paths:
- **Epic** (score 65-79) — Layout avec score block aligne a droite + divider violet
- **Standard** (neutral + master) — Layout simple avec signal tags + streamer avatar

### Props

```typescript
interface TrendingCardProps {
  clip: TrendingClip
  onRemix?: (clip: TrendingClip) => void
  onQuickExport?: (clip: TrendingClip) => void
  onShowDetail?: (clip: TrendingClip) => void  // Opens TrendingDetailModal
  quickExportState?: QuickExportState | null
  remixing?: boolean
  isSaved?: boolean
  onToggleSave?: (clipId: string) => void
  onToggleGroup?: (groupId: string) => void
  isGroupExpanded?: boolean
}
```

### Card Features (v2.1 — all card paths)

These features are present on ALL 4 card paths (neutral, epic, legendary, master):

- **Export count badge**: `🔥 exported Nx` near verdict when `export_count > 2 && score >= 65`
- **Quick Export CTA**: Zap icon button next to primary CTA (ghost/outline style)
- **"Why this clip?" link**: Opens TrendingDetailModal with score breakdown, stats, sparkline
- **Verdict + reason**: Colored by verdictColor, `verdict.text` + `↑ verdict.reason`
- **Bookmark**: Save/unsave toggle per card

### CTA Style (amber primary, all ranks)

All primary CTAs use amber gradient: `linear-gradient(135deg, #D97706, #B45309)` → hover `#F59E0B, #D97706`.
Rank identity expressed via frames/scores/glows, NOT CTA color. Quick Export is ghost/outline.

### Thumbnail Shimmer Skeleton

While the thumbnail image loads, a shimmer gradient (`from-zinc-800 via-zinc-700 to-zinc-800`, 1.4s animation) is shown.
Image starts at `opacity-0` and fades in on load. On error, falls back to streamer gradient.

### Animations — hover-only (perf fix)

ALL continuous animations are gated behind `:hover` to avoid main thread jank at rest:
- **Legendary**: legGemGlow, legShimmerPass, legScoreGlow, legBtnShine → only on `.r-legendary:hover`
- **Master**: masterShimmer, skullBob, ctaShimmer → only on `.r-master:hover`
- Already hover-only: legGlowBreathe, legGodray, legFloatParticle, masterRotate, masterPulse, haloBreathe, spark
- Static frames/ornaments remain visible at rest

### Valeurs derivees dans la carte

```typescript
const rank = clipRank(clip)              // common → master
const insight = getClipInsight(clip)     // { icon, text } | null
const tierClass = getRankTierClass(rank) // 'r-neutral' | 'r-epic' | 'r-legendary' | 'r-master'
const score = Math.round(clip.velocity_score)
const isMaster = rank === 'master'
const isLegendary = rank === 'legendary'
const isEpic = rank === 'epic'
const tiltAmplitude = isMaster ? 12 : isLegendary ? 10 : isEpic ? 8 : 5
```

### Streamer gradients

12 streamers ont un gradient personnalise pour le fallback avatar:

| Handle | Gradient |
|---|---|
| kaicenat | purple → pink → red |
| ishowspeed | red → orange → yellow |
| xqc | blue → indigo → purple |
| hasanabi | red → red → orange |
| jynxzi | emerald → teal → cyan |
| adinross | violet → purple → fuchsia |
| sketch | sky → blue → indigo |
| amouranth | pink → rose → red |
| marlon | amber → orange → red |
| neon | lime → green → emerald |
| stabletronaldo | yellow → amber → orange |
| caseoh_ | orange → red → pink |

Fallback generique: `from-slate-700 via-slate-600 to-slate-500`

### Hover Video Preview

1. `handleMouseEnter()` — set hovered=true, si Twitch + pas encore fetche:
   - Extrait le slug depuis `external_url` (2 formats: `clips.twitch.tv/{slug}` ou `twitch.tv/{channel}/clip/{slug}`)
   - Fetch `GET /api/clips/video-url?slug={slug}` → `video_url` (CloudFront signed MP4)
   - Stocke dans `resolvedVideoUrl` (persiste entre hovers grace a `fetchedRef`)
2. Quand `hovered && videoUrl` → `showVideo=true` → affiche `<video>` autoPlay muted loop
3. `handleMouseLeave()` → pause, reset, hide

### Elements overlay du thumbnail

| Element | Position | Condition |
|---|---|---|
| Platform badge | top-2 left-2 | `!showVideo` |
| Master skull badge | top-42px left-10px | `isMaster` |
| Epic frame (4 corners) | inset 0 | `isEpic` |
| Master frame (4 edges + 4 corners + crown) | inset 0 | `isMaster` |
| Score number (Archivo Black) | bottom-8 right-10 | `score !== null` (neutral/master only, hidden for epic/legendary) |
| Master sparks (5 dots) | top-4 right-8 | `isMaster` |
| Duration pill | bottom-2 left-2 | `!showVideo && clip.duration_seconds` |
| Play button (circle) | center | `!showVideo`, hidden par defaut, visible au hover |
| Bookmark + External link | bottom-2 right-2 | `!showVideo`, opacity-0 → hover:opacity-100 |

### Meta section par rank

All paths share: verdict.text + export count badge + verdict.reason + "Why this clip?" + CTA (amber) + Quick Export (ghost) + Bookmark.

**Neutral (common/rare/super_rare):**
- Title (line-clamp-2)
- Streamer avatar circle + @handle + niche
- Signal tags (Hot/Gem badges, visible au hover via CSS `.signal-tag`)
- Score number (text-xl, right-aligned)
- CTA amber gradient + Quick Export (ghost) + Bookmark

**Epic:**
- Flex row: [Title + @handle + verdict + export badge + reason + "Why this clip?"] [Score block (38px Archivo)]
- Epic divider (gradient violet)
- CTA amber gradient + Quick Export (ghost) + Bookmark

**Master:**
- Same as neutral but CTA avec SkullIcon au lieu de CTAIconComponent
- Score on thumbnail (big, with wolf icon)

**Legendary:**
- Ornate gold frame with gems, sparkles, godray
- Flex row: [Title + @handle + verdict + export badge + reason + "Why this clip?"] [Score block (54px gold gradient) + wolf SVG]
- Gold divider (leg-divider)
- CTA gold themed (leg-cta) + Quick Export (amber outline) + Bookmark

### Signal Tags

Affiches dans la section meta des cartes neutral/master quand `insight` existe ET `feed_category` est `hot_now` ou `early_gem`:

- **Hot** : rose badge, Flame icon, `rgba(239,68,68,.1)` background
- **Gem** : vert badge, Sparkles icon, `rgba(34,197,94,.1)` background

Anime via CSS: `.signal-tag` = `opacity:0; max-height:0` → `.clip:hover .signal-tag` = `opacity:1; max-height:24px`

### 3D Tilt (use-tilt.ts)

Hook framer-motion pour effet 3D au hover:
- `rotateAmplitude`: 5 (neutral), 8 (epic), 10 (legendary), 12 (master)
- `scaleOnHover`: 1.0 (pas de scale, le scale est gere par CSS)
- Spring config: `{ damping: 30, stiffness: 100, mass: 2 }`
- Calcul: offset X/Y normalise [-1,1] depuis le centre de la carte → rotateX/Y via springs

---

## Rank Cards CSS (`app/rank-cards.css`)

### 4 tiers visuels

| Tier | Classe | Score | Theme |
|---|---|---|---|
| Neutral | `.r-neutral` | < 65 | Gris sobre, border #181C26, CTA opacity .75 |
| Epic | `.r-epic` | 65-79 | Violet, corners brackets, CTA gradient violet |
| Legendary | `.r-legendary` | 80-94 | Or ornamente, frame double couche, sparkles SVG |
| Master | `.r-master` | 95+ | Feu/or, conic-gradient animee, halo, crown |

### Neutral (`.r-neutral`)

- Border: `#181C26`, hover: translateY(-2px) scale(1.01), border-color #2A3145
- Score: `#9CA3AF`, 42px, font-weight 700
- CTA: bg `#161B27`, opacity .75 → hover opacity 1

### Epic (`.r-epic`)

- Border: `rgba(139,92,246,.18)`, hover: translateY(-2px), border-color .4
- Score dans thumbnail: **hidden** (`.r-epic .rank-score { display: none }`)
- Score dans meta: `.epic-score-num` 38px, color `#A78BFA`, text-shadow violet
- Corners: 16x16px, border-top + border-left 1.5px `#A78BFA`
- CTA: gradient `#7C3AED → #6D28D9`, opacity .7 → hover 1

### Legendary (`.r-legendary`)

- Structure frame: `.leg-frame` (outer gold) → `.leg-frame-inner-border` (dark gap) → `.leg-frame-inner-gold` (inner gold) → `.leg-thumb` (thumbnail)
- 8 gem ornaments: 4 corners + 4 sides (SVG `LegGoldGem`)
- Glow: radial-gradient jaune, blur 24px, animation `legGlowBreathe` 3s
- 4 sparkle particles: `LegSparkle4` SVG, animation `legFloatParticle` 2.4s
- Godray sweep: gradient blanc, animation `legGodray` 5s
- Shimmer on hover: barre blanche, animation `legShimmerPass` 3s
- Score: hidden dans thumbnail, affiche dans meta via `.leg-score-big` (54px gold gradient)
- CTA: `.leg-cta` — gold outline, dark bg, animation shine `legBtnShine` 3s

### Master (`.r-master`)

- Border: 2.5px transparent avec `conic-gradient` animee (gold → orange → fire → gold)
- Animation rotation: `masterRotate` 10s linear infinite (via `@property --rot`)
- Animation pulse: `masterPulse` 5.5s, brightness 1 → 1.12
- Halo externe: `::after` pseudo, inset -28px, radial-gradient orange, animation `haloBreathe` 5s
- Thumbnail shimmer: `::before` pseudo, gradient gold, animation `masterShimmer` 4.5s, mix-blend-mode screen
- Score: 104px, color `#FFE066`, text-shadow triple couche (glow + highlight + drop)
- Edges: 4 bars 3px, gradient `#FCD34D → #B45309 → #FCD34D`
- Corners: 34x34px SVG `MasterCorner` avec filigree + skull
- Crown: SVG `MasterCrown` 110x44px, 5 prongs + gems, position top center
- Skull badge: 34x34px circle, radial-gradient gold, animation `skullBob` 3s
- Sparks: 5 dots animees `spark` 3.2s, positions echelonnees right side
- CTA: double outline gold (3 box-shadows), radial-gradient warm top, shimmer `ctaShimmer` 4s

### 11 Animations CSS

| Animation | Duree | Usage |
|---|---|---|
| `legGlowBreathe` | 3s ease-in-out | Legendary glow behind card |
| `legFloatParticle` | 2.4s ease-out | Legendary sparkle particles |
| `legGemGlow` | 2.8s ease-in-out | Legendary corner/side gem glow |
| `legGodray` | 5s ease-in-out | Legendary godray sweep |
| `legShimmerPass` | 3s ease-in-out | Legendary hover shimmer bar |
| `legScoreGlow` | 2s ease-in-out | Legendary score glow (not used in current card) |
| `legBtnShine` | 3s ease-in-out | Legendary CTA shine sweep |
| `masterRotate` | 10s linear | Master conic-gradient rotation |
| `masterPulse` | 5.5s ease-in-out | Master brightness pulse |
| `masterShimmer` | 4.5s ease-in-out | Master thumbnail shimmer |
| `ctaShimmer` | 4s ease-in-out | Master CTA shimmer |
| `haloBreathe` | 5s ease-in-out | Master halo opacity pulse |
| `skullBob` | 3s ease-in-out | Master skull bob up/down |
| `spark` | 3.2s ease-in-out | Master spark dots fade in/out |

### Reduced motion

`@media (prefers-reduced-motion: reduce)` → toutes les animations master/legendary desactivees.

### Score font

`var(--font-score)` → 'Archivo Black', fallback 'Arial Black', sans-serif. Font-variant-numeric: tabular-nums.

---

## Rank Badge Components (`rank-badge.tsx`)

### getRankTierClass(rank: ClipRank) → string

| Rank | Classe |
|---|---|
| master | `r-master` |
| legendary | `r-legendary` |
| epic | `r-epic` |
| common / rare / super_rare | `r-neutral` |

### DiamondCorner

SVG diamant 32x32 avec facettes multi-couches. Utilise dans legendary frame (actuellement remplace par `LegGoldGem` dans trending-card).

### MasterCorner

SVG filigree 34x34 avec:
- Scrollwork dore (path courbe)
- Cercle central avec mini skull (ellipse + yeux + bouche)
- Bec dore en haut et a gauche
- Halo radial-gradient

### MasterCrown

SVG crown 78x32 (affiche a 110x44) avec:
- Base rectangulaire doree
- 5 prongs (centre le plus haut, lateraux moyens, externes petits)
- Gemme circulaire sur chaque prong (radial-gradient)
- Scrollwork decoratif entre les prongs
- Gemme centrale sur la base

### SkullIcon

SVG skull 24x24, fill currentColor. Utilise dans le CTA master et le badge skull.

---

## Legendary Card — Detail du rendu SVG

### LegGoldGem (w=28, h=32)

Gemme doree facettee avec 8 facettes (3 top triangles + 4 bottom facettes) + highlight + sparkle point. Utilise des gradient defs partages.

### LegGemDefs

SVG invisible (width=0, height=0) avec 8 linearGradient defs:
- `gc1`, `gc2`, `gc3` — top facettes
- `gt` — top band
- `gpl`, `gpml`, `gpmr`, `gpr` — bottom facettes
- `trendFill` — gradient pour mini graph (pas utilise dans la carte actuelle)

### LegSparkle4

SVG 24x24, 4-branch star shape (`M12 0L13.5 10.5L24 12...`), fill `#FFF8E1`.

---

## TrendingDetailModal

### Sections

1. **Header** — Platform badge + niche badge + score number + title
2. **Streamer + Duration** — @handle (display_name) + duration Badge
3. **Feed category** — Colored card avec icon + label + description
4. **Stats grid** (3 colonnes x 2 rangees) — Views, Likes, Velocity, Score, Created, Exports
5. **Sparkline** — Mini graph si > 1 point de donnees (fetch GET /api/clips/sparkline?ids={id})
6. **Score Breakdown** — Collapsible "Why this score", top 3 facteurs + saturation penalty si > 30
7. **URL** — Affichage tronque + bouton Copy
8. **Actions** — "View original" (external link) + "Make Viral" (onRemix)

### Score Breakdown (ScoreBar)

Couleur de la barre basee sur le score:
- `>= 70` → emerald
- `>= 40` → amber
- `< 40` → red

Facteurs tries par score desc, top 3 affiches. Saturation penalty affichee separement si > 30.

### Feed Category Labels

| Category | Label | Description | Color |
|---|---|---|---|
| hot_now | Hot Now | Exploding right now — high velocity in the last 6h | orange |
| early_gem | Early Gem | Fresh clip (<2h) with strong early signals — could go viral | cyan |
| proven | Proven Viral | Already validated by the algorithm — safe to repost | green |
| normal | Normal | Standard clip, no special signals | muted |

---

## API Endpoints

### GET /api/trending

**Params:**
- `sort`: `velocity` (defaut) | `date` | `views`
- `limit`: 1-200 (defaut 50)
- `cursor`: `{sortValue}_{id}` pour pagination
- `niche`: string, comma-separated (ilike single, in multi)
- `platform`: string, comma-separated (valides: twitch, kick, youtube_gaming)
- `search`: string (sanitise: strip `%_\\'().,;`, max 100 chars, ilike sur title/author_name/author_handle)
- `duration`: `short` (<30) | `medium` (30-60) | `long` (>=60)
- `feed`: `hot_now` | `early_gem` | `proven` | `recent`

**Sort + Cursor:**
- `velocity` sort: `ORDER BY velocity_score DESC, id DESC` + cursor `(velocity_score, id) < (cursorValue, cursorId)`
- `date` sort ou feed=recent: `ORDER BY clip_created_at DESC, id DESC` + cursor `(clip_created_at, id) < (cursorValue, cursorId)`

**Response:**
```typescript
{
  data: TrendingClip[],
  error: string | null,
  message: string,
  meta: { total: number, limit: number, next_cursor: string | null }
}
```

**Stream Grouping (post-processing):**
Apres le fetch DB, `applyStreamGrouping()` modifie les clips in-place:
1. Grouper par `streamer_id`
2. Trier par `clip_created_at` ascendant
3. Merger les clips adjacents dans un gap de 3h
4. Ignorer les groupes de < 3 clips
5. Dans chaque groupe: trier par `velocity_score` desc, premier = representant, reste = collapsed
6. Ajouter: `stream_group_id` (stable hash `sg_{streamer_id_prefix}_{rounded_hour}`), `stream_group_count`, `stream_group_collapsed`

**Rate limiting:** `browse:{ip}`, limite configurable via `RATE_LIMITS.browse`.

**Auth:** Pas requis pour GET (lecture publique via admin client).

### POST /api/trending

**Auth:** API key (`x-api-key` header comparee a `N8N_API_KEY`) OU utilisateur authentifie avec plan `studio`.

**Body (Zod):**
```typescript
{
  external_url: string (URL, required, unique constraint)
  platform: 'twitch' | 'youtube_gaming' | 'kick' (required)
  title?: string (max 500)
  description?: string (max 2000)
  author_name?: string (max 200)
  author_handle?: string (max 200)
  niche?: string (max 100)
  view_count?: number (int, >= 0)
  like_count?: number (int, >= 0)
  velocity_score?: number (>= 0)
  thumbnail_url?: string (URL)
}
```

**Comportement:** Upsert sur `external_url` (onConflict). Retourne 201.

### POST /api/render/quick

**Auth:** Requis (withAuth middleware).

**Body (Zod):**
```typescript
{
  clip_id: string (UUID, required)
  source: 'clips' | 'trending' (default 'trending')
}
```

**Flow:**
1. Rate limit sur `render:{user.id}`
2. Idempotency key via `x-idempotency-key` header → Redis check (5min TTL)
3. Resolve clip (admin fetch depuis trending_clips ou clips)
4. Check existing job (meme clip + user + source)
5. Enforce plan limits (quota, duration)
6. Resolve Twitch URL si necessaire
7. Mood detection (best-effort, Claude Haiku, 15s timeout)
8. Build settings depuis mood preset
9. Enqueue render (Redis queue)
10. Return `{ jobId, status, mood, queued? }`

### GET /api/bootstrap

**Response:**
```typescript
{
  data: {
    saved_clip_ids: string[],
    recent_remixes: BootstrapRemix[],
    profile: { plan: string, monthly_videos_used: number, bonus_videos: number } | null
  }
}
```

Utilise `Promise.allSettled` — echec partiel ne bloque pas.

### GET /api/clips/video-url?slug={slug}

Resout un slug Twitch en URL video signee CloudFront via Twitch GQL `VideoAccessToken_Clip`. Cache en memoire (1h TTL).

### GET /api/clips/sparkline?ids={uuid1,uuid2,...}

Batch snapshots pour mini graphes velocity. Max 50 clips. Response: `{ data: Record<string, number[]> }`.

### GET /api/clips/my-remixes?limit=20

Render jobs de l'utilisateur enrichis avec clip metadata + signed download URLs. Response: `{ data: RemixJob[], count: number }`.

### GET/POST/DELETE /api/clips/saved

Bookmarks CRUD. POST: upsert on conflict `(user_id, clip_id)`.

---

## RemixCard

### Interface RemixJob

```typescript
interface RemixJob {
  id: string
  clip_id: string
  source: string
  status: string          // 'done' | 'rendering' | 'pending' | 'error' | 'expired'
  storage_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  downloadUrl: string | null
  can_download: boolean
  clip: {
    title: string | null
    thumbnail_url: string | null
    platform: string
    velocity_score: number | null
    author_handle: string | null
  } | null
}
```

### Status config

| Status | Icon | Label | Color | Animate |
|---|---|---|---|---|
| done | CheckCircle | Done | green-400 | non |
| rendering | Loader2 | Rendering... | amber-400 | spin |
| pending | Clock | In queue | muted | non |
| error | XCircle | Failed | red-400 | non |
| expired | TimerOff | Expired | muted | non |

### Actions par status

- **done/rendering/pending** : Download + Compare (Before/After player) + Re-edit
- **expired** : Message "Free clips expire after 7 days" + "Remix Again" link

---

## ExportTicker (Social Proof)

### Fonctionnement

1. Souscrit au channel Supabase Realtime `export-feed`, event `new_export`
2. Reçoit `{ score, rank, platform, timestamp }`
3. Affiche "A creator just exported [a Master/Legendary/etc. clip] (Score XX)"
4. Auto-hide apres 8 secondes
5. Garde les 5 derniers events en memoire

### Rank labels

| DB rank | Label affiche |
|---|---|
| mega_viral | Master |
| viral | Legendary |
| hot | Epic |
| rising | Rare |
| normal / dead | (pas de label) |

---

## NotificationBell

### Declenchement

Quand `fetchClips()` detecte de nouveaux clips (ID pas dans prevClips) avec `velocity_score >= 80`, cree des `ViralNotification` objects.

### UI

- Bouton cloche dans le header (via le layout, pas dans la page)
- Badge rouge anime (pulse) si unreadCount > 0 (max affiche "9+")
- Portal dropdown positionne `top:80px, left:272px` (desktop) ou `left:16px, right:16px` (mobile)
- Max 20 notifications, max-h-72 scrollable
- Chaque notification: Flame icon + title + platform + score + timeAgo

---

## Quick Export Flow

### Etat local dans page.tsx

```typescript
quickExport: QuickExportState | null   // { clipId, jobId, status, downloadUrl?, errorMessage? }
renderNotification: { clipId, clipTitle, downloadUrl, status, errorMessage? } | null
```

### Flow complet

1. Clic sur "Make It Viral" (via `onRemix` qui fait `router.push`)
   - Note : dans le code actuel, l'event `onClick` sur la div wrapper de la carte fait `handleEnhance` (navigation vers enhance page), et le CTA button fait aussi `onRemix` = `handleEnhance`
   - Quick Export via `onQuickExport` est WIRED_REAL dans les props mais le CTA appelle `onRemix`, pas `onQuickExport`. Quick Export (/api/render/quick) : WIRED_REAL — API fonctionne, mais le CTA n'est PAS expose dans l'UI Browse actuelle. Accessible uniquement via le detail modal (si wire).

2. **Si Quick Export est utilise** (via `handleQuickExport`):
   - Set quickExport state = rendering
   - POST /api/render/quick avec idempotency key
   - On success: set jobId + subscribe via useRenderSubscription
   - On done: fetch signed URL via GET /api/render/status
   - Show notification toast (fixed bottom-right)

### Rendering indicator

Fixed bottom-right, violet card: Loader2 spinner + "Rendering your clip..." + "You can keep browsing"

### Completion notification

Fixed bottom-right, rounded-2xl:
- **Done**: violet border, CheckCircle icon, "Your clip is ready!", buttons: Enhance (violet) + Download (outline)
- **Error**: red border, AlertCircle icon, error message

Auto-dismiss apres 15s (`notifTimerRef`).

---

## Upload Flow (Direct-to-Storage, 3 etapes)

> **Netlify limit**: les fonctions serverless plafonnent a ~6 MB de payload.
> L'upload passe donc directement du client vers Supabase Storage via signed URL.

### Architecture 3 etapes

1. **Init** — `POST /api/upload/sign` : auth + validation (2 GB max, types video) + cree row `videos` (`status='uploading'`) + retourne `{ signedUrl, videoId }`
2. **Upload** — Le client PUT le fichier directement sur `signedUrl` (Supabase Storage). XHR avec `upload.progress` pour le suivi. Netlify n'est plus dans le chemin.
3. **Complete** — `POST /api/upload/complete { videoId }` : verifie que le fichier existe dans Storage, update `status='uploaded'`, retourne la row.

### Retry

- Si le PUT echoue, le client peut re-init avec `existingVideoId` pour reutiliser la meme row (evite les orphelins).
- Si abandon, `DELETE /api/upload/sign?videoId=xxx` nettoie la row.
- Cron `cleanup-storage` purge les rows `status='uploading'` de plus de 24h.

### Validation client

- Max file size: 2 GB
- Accepted types: `video/mp4, video/quicktime, video/x-matroska, video/avi, video/webm, .mp4, .mov, .mkv, .avi, .webm`

### Post-upload

Sur succes de l'etape 3: `setUploadSuccess(true)` → redirect vers `/dashboard/enhance/{videoId}?source=upload` apres 600ms.

### UI upload button

- Normal: dashed border, UploadCloud icon, "Upload clip"
- Uploading: Loader2 spin, progress "%"
- Success: CheckCircle2 vert, "Redirecting..."

---

## Platform Preview Support

| Platform | Browse preview | Enhance preview | Render source |
|---|---|---|---|
| Twitch | MP4 signed URL (CloudFront) | MP4 signed URL | MP4 via VPS download |
| Kick | HLS proxy (hover preview) | Thumbnail fallback (pas de MP4 direct) | URL externe via VPS (si supporte) |

---

## Stream Grouping

### Detection (API-side)

- Meme `streamer_id` + `clip_created_at` dans un gap de 3 heures
- Minimum 3 clips pour former un groupe

### Algorithme

1. Grouper par streamer_id
2. Trier par clip_created_at ascendant
3. Merger clips adjacents si gap <= 3h
4. Trier chaque groupe par velocity_score desc
5. Premier clip = representant (collapsed=false), reste = collapsed=true

### Frontend

- `expandedGroups: Set<string>` dans le store
- `applyFilters()` filtre les clips collapsed sauf si leur groupe est dans expandedGroups
- `toggleGroup(groupId)` toggle l'expansion

### Group ID stable

`sg_{streamer_id[0:8]}_{Math.floor(midTime / 3_600_000)}`

---

## Utility Functions

### formatCount(n) — `lib/trending/utils.ts`

| Input | Output |
|---|---|
| null | '--' |
| 842 | '842' |
| 1200 | '1.2K' |
| 12300 | '12.3K' |
| 1500000 | '1.5M' |

### timeAgo(dateStr) — `lib/trending/utils.ts`

| Delta | Output |
|---|---|
| < 60min | '{X}m' |
| < 24h | '{X}h' |
| >= 24h | '{X}j' |

### formatDuration(seconds) — local dans trending-card.tsx

`m:ss` format. Ex: 45 → "0:45", 130 → "2:10"

---

## Constants (`lib/trending/constants.ts`)

### PLATFORM_STYLES

```typescript
{
  twitch: { label: 'Twitch', colorClass: 'text-purple-400', badgeClass: 'text-purple-400 bg-purple-500/15 ...' }
  kick: { label: 'Kick', colorClass: 'text-green-400', badgeClass: '...' }
  youtube_gaming: { label: 'YouTube Gaming', colorClass: 'text-red-400', badgeClass: '...' }
}
```

### NICHE_LABELS

12 niches: irl, just_chatting, fps, moba, rpg, slots, music, sports, fighting, racing, creative, variety.

---

## VelocityBadge (non utilise dans la carte actuelle)

4 tiers visuels basees sur le score:

| Score | Label | Icon | Style | Animate |
|---|---|---|---|---|
| >= 80 | Viral | Flame | orange, glow shadow | pulse |
| >= 50 | Hot | Flame | yellow | non |
| >= 20 | Rising | TrendingUp | blue | non |
| < 20 | Slow | Minus | muted | non |

---

## TrendingStatsPanel (non utilise dans la page actuelle)

6 StatCards:
1. Tracked clips (total)
2. Epic+ (epic + legendary + master count)
3. Super Rare+ (super_rare + epic + legendary + master count)
4. Avg algo score (avgVelocity)
5. Top game (topGame + count)
6. Last scan (lastRefreshed timeAgo + lastScrapedAt)

Plus: platform breakdown bar (Twitch purple / Kick green / YouTube red).

---

## Ce qui est WIRED_REAL vs SIMULATED

| Feature | Status |
|---|---|
| Clip feed (Supabase, cursor pagination) | WIRED_REAL |
| Scoring V2 (7 facteurs, tiers, feed categories) | WIRED_REAL |
| Feed tabs (all default / hot_now / proven / recent / saved) | WIRED_REAL |
| Feed categories client-side filtering | WIRED_REAL |
| Server-side filtering (search, niche, platform, duration, feed) | WIRED_REAL |
| Search debounce (300ms) | WIRED_REAL |
| Niche pills dynamiques (count-based) | WIRED_REAL |
| Cursor pagination (load more, dedup) | WIRED_REAL |
| Stream grouping (API post-processing) | WIRED_REAL |
| Hover video preview (Twitch GQL -> CloudFront MP4) | WIRED_REAL |
| Bookmark save/unsave (optimistic + rollback) | WIRED_REAL |
| Bootstrap fetch (saved + profile + remixes) | WIRED_REAL |
| Quick Export (mood detection + render pipeline) | WIRED_REAL — CTA expose sur les cartes (Zap icon) |
| Render subscription (Realtime + polling fallback) | WIRED_REAL |
| Upload clip (XHR progress, redirect to enhance) | WIRED_REAL |
| Rank card CSS (4 tiers visuels) | WIRED_REAL |
| 3D tilt (framer-motion springs) | WIRED_REAL |
| Notification bell (viral clips >= 80) | WIRED_REAL |
| Export ticker (Supabase Realtime broadcast) | WIRED_REAL |
| Sparkline (detail modal, batch snapshots) | WIRED_REAL |
| Score breakdown (top 3 factors + saturation) | WIRED_REAL (donnees du clip, pas d'appel extra) |
| Clip verdict system (contextual verdicts + dynamic CTA) | WIRED_REAL (sub-scores reels depuis clip-scorer.ts) |
| Detail modal | WIRED_REAL — ouvert via "Why this clip?" sur les cartes |
| Twitch refresh (POST /api/streams/refresh) | WIRED_REAL |
| RemixProgress overlay | SIMULATED (steps avec timers fixes, pas de poll reel) |
| VelocityBadge component | DEAD_CODE volontaire (redondant avec verdict system) |
| TrendingStatsPanel component | DEAD_CODE volontaire (redondant avec feed tabs + in-card signals) |
| Export count badge on Epic+ cards | WIRED_REAL — shows "exported Nx" when export_count > 2 |
| Kick video preview (HLS proxy) | WIRED_REAL (via kick-proxy route) |

---

## Scoring Integration

### Comment les scores sont utilises dans le Browse

| Champ DB | Utilisation UI |
|---|---|
| `velocity_score` | Score affiche sur la carte (Archivo Black), rank derivation, tri par defaut |
| `tier` | Ignore par le frontend (clipRank() derive de velocity_score) |
| `feed_category` | Signal tags (Hot/Gem), filtrage par tab, detail modal badge |
| `momentum_score` | getClipInsight() (>= 65 → "High momentum"), detail modal breakdown |
| `anomaly_score` | getClipInsight() (>= 70 → "Outperforms streamer avg"), detail modal breakdown |
| `engagement_score` | getClipInsight() (>= 75 → "High engagement"), detail modal breakdown |
| `early_signal_score` | getClipInsight() (>= 50 → "Spike detected"), detail modal breakdown |
| `format_score` | getClipInsight() (=== 100 → "Perfect format"), detail modal breakdown |
| `recency_score` | Detail modal breakdown (label "Freshness") |
| `saturation_score` | Detail modal breakdown (penalty si > 30) |
| `velocity` | Detail modal stats grid ("+X/h" format) |
| `export_count` | Detail modal stats grid |
| `view_count` | Detail modal stats grid |
| `like_count` | Detail modal stats grid |

---

## Clip Verdict System (`lib/browse/clip-verdict.ts`)

Systeme contextuel qui remplace les phrases hardcodees ("Peak viral potential", "High viral potential", "Make It Viral") par des verdicts dynamiques bases sur les sub-scores reels du clip.

### getClipVerdict(clip) — Verdict contextuel

Cascade de 11 conditions (premiere qui matche gagne). Toutes les valeurs null sont traitees comme 0.

| # | Condition | Verdict (text) | Reason |
|---|---|---|---|
| 1 | early_signal >= 60 AND saturation <= 30 | Exploding — catch it now | Early spike + low saturation |
| 2 | momentum >= 70 AND recency >= 60 | Surging fast | High momentum + fresh clip |
| 3 | momentum >= 70 | Strong momentum | Trending velocity above average |
| 4 | anomaly >= 70 | Outperforming expectations | Beats streamer's usual performance |
| 5 | engagement >= 75 AND format == 100 | Perfect setup | High engagement + ideal format |
| 6 | engagement >= 70 | High engagement clip | Strong like-to-view ratio |
| 7 | early_signal >= 40 | Early signal detected | Gaining traction fast |
| 8 | velocity_score >= 60 | Solid performer | Consistent metrics across the board |
| 9 | velocity_score >= 40 | Moderate potential | Needs a strong hook to stand out |
| 10 | recency <= 20 AND velocity_score >= 30 | Late but still climbing | Older clip still gaining views |
| 11 | (default) | Worth a shot | Test with your audience |

### getDynamicCTA(clip) — CTA dynamique

Base sur velocity_score. Retourne `{ label: string; icon: CTAIcon }`.

| Score | Label | Icon (lucide) | Remplace |
|---|---|---|---|
| >= 80 | Capture this trend | Flame | "Make It Viral" (statique) |
| >= 65 | Boost & post | Sparkles | "Make It Viral" (statique) |
| >= 45 | Optimize first | SlidersHorizontal | "Make It Viral" (statique) |
| < 45 | Risky play | Zap | "Make It Viral" (statique) |

### getVerdictColor(score) — Couleur du verdict

| Score | Couleur hex | Tailwind equivalent |
|---|---|---|
| >= 80 | #FDBA74 | orange-300 |
| >= 65 | #A78BFA | violet-400 |
| >= 45 | #94A3B8 | slate-400 |
| < 45 | #71717A | zinc-500 |

### Integration par type de carte

**Legendary :**
- `verdict.text` remplace le hardcode "Peak viral potential" dans `.leg-hook`
- `.leg-hook` colore dynamiquement via `style={{ color: verdictColor }}`
- Ligne `verdict.reason` ajoutee en dessous (text-[10px] text-zinc-500)
- CTA: emoji prefix (fire si Flame, sinon star) + `dynamicCTA.label`

**Epic :**
- `verdict.text` remplace "High viral potential" (text-xs font-semibold, colore par verdictColor)
- Ligne `verdict.reason` ajoutee en dessous
- CTA: `CTAIconComponent` (icon dynamique) + `dynamicCTA.label`

**Default (neutral + master) :**
- `verdict.text` + `verdict.reason` ajoutes entre les signal tags et le bouton CTA
- CTA: master garde `SkullIcon`, les autres utilisent `CTAIconComponent` + `dynamicCTA.label`

**Ce qui n'a PAS change :**
- Score numerique (Archivo Black) — toujours visible
- Signal tags (Hot/Gem badges) — toujours presents, complementaires au verdict
- Tiers visuels (frames, glow, sparkles, crown) — intacts
- 3D tilt, hover video preview, bookmark — intacts

### Sources de donnees

| Sub-score | Colonne DB (trending_clips) | Origine |
|---|---|---|
| early_signal_score | early_signal_score | clip-scorer.ts (detection precoce <6h) |
| momentum_score | momentum_score | clip-scorer.ts (vitesse + acceleration) |
| recency_score | recency_score | clip-scorer.ts (decroissance exponentielle) |
| anomaly_score | anomaly_score | clip-scorer.ts (= authority_score, performance vs streamer avg) |
| engagement_score | engagement_score | clip-scorer.ts (ratio likes/vues + signaux titre) |
| format_score | format_score | clip-scorer.ts (duree optimale 15-45s = 100) |
| saturation_score | saturation_score | clip-scorer.ts (penalite vieux clips viraux) |
| velocity_score | velocity_score | clip-scorer.ts (score final composite V2 0-100) |

Tous les scores sont calcules par `lib/scoring/clip-scorer.ts` et mis a jour par le cron `app/api/cron/rescore-clips/route.ts`.

---

## Systemes Connexes

### Cron fetch-twitch-clips (import clips Twitch + Kick)
- **Route** : `app/api/cron/fetch-twitch-clips/route.ts`
- **Declencheur externe** : cron-job.org, POST toutes les 5 min, header `x-api-key` = CRON_SECRET, timeout HTTP 30s
- **Time budget** : 15s max — arrete le traitement et repond immediatement quand depasse
- **Limite dure** : max 5 streamers par invocation (4 Twitch + 1 Kick)
- **Staggering** : `ORDER BY last_fetched_at NULLS FIRST` — les streamers les moins recemment fetches passent en premier, tous les streamers sont couverts au fil des invocations successives
- **last_fetched_at** : colonne TIMESTAMPTZ sur `public.streamers`, mise a jour **a chaque TENTATIVE** (finally block) — succes, 0 clips, OU erreur. Garantit que les streamers en echec vont au fond de la file et ne bloquent jamais la rotation.
- **Reponse JSON** : `{ processed, skipped, remaining, elapsed_ms, timed_out, upserted, ... }`
- **Logique par-streamer** : `lib/twitch/fetch-streamer-clips.ts` (Twitch), `lib/kick/fetch-kick-clips.ts` (Kick)
- **Observabilite** : `logger.error` si 0 clips upserted ET errors > 0 (deadlock symptom)
- **Watchdog** : `checkTrendingClipsFreshness` alerte CRITICAL si MAX(created_at) trending_clips > 6h (le symptome visible d'un radar mort)

### Scores ← Scoring Engine
- `lib/scoring/clip-scorer.ts` calcule les 7 sub-scores + velocity_score pour chaque clip
- `app/api/cron/rescore-clips/route.ts` re-score selon un cron stratifie (<6h: 15min, 6-24h: 1h, >24h: 1j)
- Le Browse consomme velocity_score, feed_category, et les sub-scores pour le verdict system et les feed tabs

### Quick Export → Render Pipeline (ENHANCE)
- `POST /api/render/quick` declenche mood detection (Claude Haiku) + enqueue render sur Railway VPS
- Resultat visible dans le toast notification (fixed bottom-right) sans quitter le Browse
- Full enhance flow: clic sur la carte navigue vers `/dashboard/enhance/[clipId]`

### Notifications In-App
- Clips avec velocity_score >= 80 apparaissant dans un fetch generent des `ViralNotification`
- Affichees dans le NotificationBell (layout header, pas dans la page Browse)

### Vision Etage 3 — Live Moment Detection (voir CLAUDE.md)
- Poll agressif des clips Twitch des streamers suivis
- Spike de velocity dans les premieres minutes = gros moment
- Notification ou auto-enhance + auto-post AVANT tout le monde
- S'appuie sur la spike detection existante (clip-scorer + cron rescore-clips)

---

## Fix: CDN cache poisoning (2026-07-02)

`/api/clips/video-url` returned `Cache-Control: public, max-age=3600` on a route whose response depends on `?slug=`. Netlify CDN served the SAME cached response for ALL slugs for 1h — this caused the historic "wrong clip on hover" bug and dead previews.

Fix: `Cache-Control: private, max-age=3600` (browser caches per full URL, CDN no longer caches). Same fix applied to `/api/clips/external` (response varies by `?path=`). The kick-proxy `.ts` segments correctly use `public, max-age=86400, immutable` (each segment URL is unique).

Hover preview is now reliable across all clips.

---

## Axes d'amelioration restants

1. **Wirer RemixProgress** — Actuellement simule avec des timers fixes, devrait poller le status reel du render job
2. **Kick video preview** — HLS proxy fonctionnel mais moins fluide que Twitch (pas de MP4 direct)
3. **Infinite scroll** — Actuellement "Load more" bouton, pourrait etre remplace par IntersectionObserver
4. **Auto-refresh** — `autoRefreshEnabled` et `autoRefreshInterval` existent dans le store mais ne sont pas utilises
