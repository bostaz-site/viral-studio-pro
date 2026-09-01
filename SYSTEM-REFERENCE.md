# SYSTEM-REFERENCE — Feature Flows & Systems

> Documents **how each feature works**: flows, files, state, APIs, dependencies, gotchas.
> For DB schema, env vars, project structure, scoring details and conventions, see `CLAUDE.md`.

---

## Glossaire des Scores (Source de Verite)

| Score | Code | Ou | Ce que c'est | Range |
|---|---|---|---|---|
| **Algo Score** | `velocity_score` | Browse, DB `trending_clips` | Score composite V2 du clip (7 facteurs : momentum, authority, engagement, recency, early signal, format, saturation) | 0-100 |
| **Blowup Chance** | `computeCurrentScore()` | Enhance | Score estime apres edition (baseline clip + poids des enhancements actives, calibres par recherche — voir `docs/research/viralite-calibration.md`). Directionnel, pas predictif. | 0-99 |
| **Breakout Probability** | `breakoutProbability` | Distribution Smart Queue | Probabilite simulee de performance si le clip est poste maintenant. Basee sur viralScore x timing x momentum. SIMULE, pas connecte a des vraies metriques post. | 0-100% |
| **Creator Score** | `creator_score` | Settings, DB `social_accounts` | Score du compte YouTube (5 facteurs : performance, engagement, growth, audience, consistency). Requiert YouTube connecte. | 0-100 |
| **Clip Momentum** | `momentum_score` | Browse, DB `trending_clips` | Sous-score V2 : vitesse de croissance des vues + acceleration. C'est UN des 7 facteurs du Algo Score. | 0-100 |
| **Creator Momentum** | `calculateMomentumScore()` | Analytics | Score de dynamique de publication du createur (activite x qualite x consistance - decay). Base sur localStorage, PAS sur des vraies metriques. | 0-100 |
| **Queue Confidence** | `confidence` | Distribution Smart Queue | Confiance dans la suggestion de la queue (nb de posts dans le learning data). SIMULE. | low/medium/high |
| **Mood Confidence** | `moodConfidence` | Enhance | Confiance de la detection de mood par Claude Haiku (vrai appel AI). | 0-100 |

### Scores admin (leads influenceurs)
| Score | Code | Ou | Ce que c'est | Range |
|---|---|---|---|---|
| **Keyword Score** | `keyword_score` | Admin Scraper | Pre-score rapide par mots-cles (heuristique, pas AI) | 0-100 |
| **Lead Score** | `lead_score` | Admin CRM | Score composite du lead (engagement, audience, activite) | 0-100 |
| **AI Affiliate Score** | `ai_affiliate_score` | Admin AI Scoring | Score Claude Haiku (niche fit, audience, sponsorship likelihood) | 0-100 |

Details : `SYSTEM-REFERENCE-ADMIN-SCRAPER.md`, `SYSTEM-REFERENCE-ADMIN-CRM.md`, `SYSTEM-REFERENCE-ADMIN-AI-SCORING.md`.

### Regle absolue
- `velocity_score` = seul score reel base sur des donnees Twitch/Kick
- Tous les autres scores sont derives, estimes, ou simules
- Ne JAMAIS confondre un score simule avec un score reel dans le code ou l'UI

---

## Lifecycle Global du Clip

```
Source                    Browse                  Enhance                 Distribution            Analytics
------                    ------                  -------                 ------------            ---------
Twitch API --> trending_clips --> /enhance/[id] --> render_jobs --> Clip Bank --> Publish --> Post metrics
Kick API   -->     |                  |                |               |              |            |
Upload     -->  videos table    AI mood detect    FFmpeg VPS      Queue engine    Social API   Streak/rewards
                    |              |                   |               |              |            |
               velocity_score  Blowup Chance      MP4 storage    Schedule post   Track perf   Creator momentum
               feed_category   mood preset        Supabase         Breakout %     (TODO)       Learning loop
               clip_rank       settings overlay   signed URL      Risk strategy   (TODO)       (localStorage)
```

### Tables DB par etape

| Etape | Tables |
|---|---|
| Browse | `trending_clips`, `streamers`, `clip_snapshots`, `saved_clips` |
| Enhance | `trending_clips` (lecture), `clips` (si upload), `transcriptions` |
| Render | `render_jobs`, Supabase Storage `clips/` |
| Distribution | `social_accounts`, localStorage (`queue-learning`, `queue-settings`, `persistent-stats`) |
| Analytics | `social_accounts`, `account_snapshots`, localStorage (`persistent-stats`) |

### Flow utilisateur principal
Browse (decouvrir) -> Enhance (transformer) -> Distribution (publier) -> Analytics (progresser)

### Bank = Explicit Autofarm Queue (3-choice model)
Render creates `render_jobs` with `removed_from_bank_at = now()` (out-of-bank by default). The bank is the autofarm's queue — entering is an explicit user choice.

**Post-render 3 actions** (UnifiedPublishDialog + Enhance page):
1. **Publish now** (primary) — manual publish via platform dialogs. Published = consumed: `removed_from_bank_at` set.
2. **Place in bank** (secondary) — `POST /api/distribution/bank` nullifies `removed_from_bank_at`. Clip enters the autofarm queue. Subtitle: "The autofarm will post it at the optimal time".
3. **Later** / **Download** — render saved but NOT in bank. Re-openable from Enhance page via `localStorage render-done:{clipId}` kill switch.

Semantics unchanged: `removed_from_bank_at IS NULL` = in bank. Only the default flipped (was NULL, now = creation timestamp).

### Flow post-render (Enhance page)
1. **Render finit** (poll `/api/render/status` detecte `status=done`)
   - `renderDownloadUrl` est set (signed URL 4h)
   - `localStorage render-done:{clipId}` ecrit avec `{ url, timestamp }` (TTL 24h)
   - `sessionStorage render-job:{clipId}` supprime APRES le localStorage write
   - `UnifiedPublishDialog` s'auto-ouvre (`setShowPublishDialog(true)`)
   - Preview switch auto sur le tab "Rendered"
2. **Panneau CTA visible** tant que `renderDownloadUrl` existe :
   - **Place in bank** : `POST /api/distribution/bank` (verifie render_jobs done, nullifie removed_from_bank_at)
   - **Chain farming** : next-best clip via `/api/trending/next-best`
   - **Publish now** : ouvre `UnifiedPublishDialog`
   - **Download MP4** : lien direct signed URL
3. **Changement de reglage post-render** :
   - `renderDownloadUrl` persiste (CTA reste visible)
   - `settingsChangedSinceRender=true` → bouton "Re-generate with new settings" (ambre)
   - Tab "Enhanced" reapparait pour montrer la preview CSS avec les nouveaux reglages
4. **Persistance refresh (F5)** :
   - `localStorage render-done:{clipId}` detecte → `GET /api/render/status?clip_id=` (server kill switch)
   - Retourne le dernier render_jobs done avec des signed URLs frais
   - Panneau CTA restaure
5. **Place in bank** :
   - `POST /api/distribution/bank` avec `{ clipId }`
   - Verifie `render_jobs.status='done'`, nullifie `removed_from_bank_at` (clip entre en banque)
   - Le clip apparait dans la Clip Bank rail de `/dashboard/distribution`
   - Bank card play: click play glyph → signed URL from `clips` bucket → `<video controls>` with imperative `play()`. Close via X button. One clip at a time.
   - Triggers chain farming (next-best clip)

---

## 1. Browse / Trending Feed

Dashboard page displaying ranked streamer clips with feed tabs, filters, infinite scroll and hover video preview.

### User Flow
1. Land on `/dashboard` -> `fetchClips()` + `fetchBootstrap()` in parallel. Clips from `GET /api/trending` (200 unfiltered), bootstrap from `GET /api/bootstrap` (saved IDs + recent remixes + profile)
2. Pick a feed tab -> client-side filter first (instant), then background server fetch if <10 results
3. Apply filters (search, platform, niche, duration) -> server-side re-fetch with filter params (search debounced 300ms). Platform filter also enforced client-side in `filterAndSortClips` (defense-in-depth against stale data from race conditions).
4. Hover on card -> resolves video URL -> inline `<video muted loop>` preview. **Twitch**: `/api/clips/video-url` → GQL → signed MP4. **Kick**: CDN playlist derived client-side from `thumbnail_url` (`clips.kick.com/.../thumbnail.webp` → `.../playlist.m3u8`). No API call, no proxy — CDN serves CORS-open HLS directly. hls.js (dynamic import, ~50KB lazy) attaches the `.m3u8`. Safari uses native HLS. **Kick API (`kick.com/api/v2`) is Cloudflare-blocked server-side (403) — never call it.** Cleanup: hls.destroy() + video.removeAttribute('src') on mouseleave.
5. **Make It Viral** (primary CTA): click -> `router.push('/dashboard/enhance/{clipId}')` for full enhance editor
6. **Quick Export** (secondary CTA): Zap icon on every card. `POST /api/render/quick` -> polls via `useRenderSubscription` (Realtime + polling fallback, adaptive backoff 3s-30s). State persisted in sessionStorage (survives grid re-render/F5). Done: toast with [Publish now] + [View bank]. Error: toast with [Retry]. Card shows green CheckCircle2 for exported clips (`exportedClipIds` Set).

### Safe Publish Floor
No render can reach TikTok "naked" — Quick Export ALWAYS includes: full-frame crop (no blurred padding), karaoke captions (mood-based style), creator credit tag (credit-text style with @handle), audio fingerprint shift (+3% asetrate/atempo, always-on), smart zoom micro (active by default). Caption engine (`lib/distribution/caption-engine.ts`): max 3-4 hashtags, niche-specific only. Blacklisted spam tags: #fyp, #foryou, #viral, #mustwatch, #watchthis, #explore, #trending, #goviral, #blowup, #algorithm, #foryoupage. Creator credit line appended to every generated caption when `authorHandle` is provided. Publish dialog shows guidance: "Raw reposts get removed — always publish enhanced versions with captions and creator credit."
7. **Top Pick** card (`top-pick-card.tsx`): best clip with `score >= 75, feed_category in (early_gem, hot_now), age < 12h`. Selected from `filteredClips` (respects all active filters incl. platform). Excluded from grid to prevent duplicate card. Score = `clip.velocity_score` (single source of truth, same as grid). Age shown in amber bold with "\u2197 still climbing". Dynamic explanation: if grid contains a higher-scoring clip older than 12h → "Higher scores below already peaked — this one is still early."
8. "Load more" -> `GET /api/trending?cursor={score}_{id}&limit=50` with same filter params

### Files
- `app/(dashboard)/dashboard/page.tsx` — page, feed tabs, upload, remix tab, grid
- `components/trending/trending-card.tsx` — card with hover preview, rank frames, signal tags, velocity stats, social proof, CTA (Quick Export + Customize). Kick thumbnails use `unoptimized` on next/image (Kick CDN serves `content-type: application/octet-stream` which breaks Netlify Image CDN). Same fix in `live-preview.tsx` and `first-clip-overlay.tsx`.
- `components/trending/trending-filters.tsx` — search input, platform/niche/duration pills, sort toggle
- `stores/trending-store.ts` — Zustand store: all clip state + actions
- `types/trending.ts` — `TrendingClip`, `FeedFilter`, `clipRank()`, `getClipInsight()`
- `app/rank-cards.css` — `.r-neutral`, `.r-epic`, `.r-legendary`, `.r-master` visual tiers
- `components/trending/rank-badge.tsx` — SVG decorations: `DiamondCorner`, `MasterCorner`, `MasterCrown`, `SkullIcon`
- `components/trending/remix-card.tsx` — `RemixJob` interface, status badge, download/re-edit

### State (Zustand: `useTrendingStore`)
- `clips`, `filteredClips`, `filters`, `savedClipIds`, `stats`, `hasMore`, `cursor`, `notifications`
- Actions: `fetchClips(silent?)`, `loadMore()`, `setFeed()`, `setFilters()`, `toggleSaveClip()`, `fetchSavedClips()`

**Server-side filtering:** When filters are active (search, niche, platform, duration, feed category), `fetchClips()` passes them as query params to `/api/trending` and fetches 50 clips. When no filters are active, fetches 200 for client-side tab switching. `loadMore()` also passes active filters.

- `setFilters()` triggers server re-fetch on niche/platform/duration/sort changes. Search is debounced 300ms.
- `setFeed()` applies client-side filter immediately; if <10 results, triggers background server fetch.
- `applyFilters()` remains as client-side safety net (feed -> search -> platform -> niche -> duration -> sort)
- `toggleSaveClip` is optimistic (updates Set immediately, rolls back on API error or non-ok HTTP response)
- `tabCountsLoaded` flag distinguishes "not yet loaded" from "loaded with 0". When counts haven't loaded, tabs show without badges; `fetchTabCounts` retries once after 5s on failure.
- `loadMore` error sets `error` state instead of swallowing silently
- API supports comma-separated `niche` and `platform` params for multi-value filters
- `expandedGroups: Set<string>` tracks which stream groups are expanded
- `toggleGroup(groupId)` toggles group expansion and re-applies filters
- `applyFilters()` hides `stream_group_collapsed: true` clips unless their group is in `expandedGroups`

### API Endpoints
- `GET /api/bootstrap` — single call replacing 3 fetches: saved clip IDs, last 5 remixes, user profile (plan + usage + bonus + is_comp). Uses `resolveEffectivePlan()` to return the effective plan (comp accounts get 'pro'). `Promise.allSettled` — partial failure returns empty arrays, never blocks.
- `GET /api/trending` — params: `sort`, `limit` (max 200), `cursor` (format `{score}_{id}`), `niche` (comma-sep), `platform` (comma-sep), `search`, `duration`, `feed`. Response: `{ data, meta: { total, next_cursor } }`. Cursor-based pagination: `(velocity_score, id) DESC` for score sort, `(clip_created_at, id) DESC` for date sort.
- `GET/POST/DELETE /api/clips/saved` — bookmarks CRUD (upsert on conflict `user_id, clip_id`)
- `GET /api/clips/video-url?slug=X&platform=twitch|kick` — Twitch GQL `VideoAccessToken_Clip` or Kick API -> direct MP4. In-memory cache (1h TTL). Enhance page resolves both Twitch and Kick clips for live preview.
- `GET /api/clips/my-remixes?limit=20` — user's `render_jobs` enriched with clip metadata + signed download URLs
- `GET /api/clips/sparkline?ids=uuid1,uuid2` — batch snapshots for mini velocity graphs (max 50 clips)

### Feed Tabs
3 visible tabs + 1 subtle: **Exploding Now** (default, Flame), **Proven Winners** (Trophy), **Fresh Drops** (24h window, Clock), **All Clips** (subtle/text link). Plus **Saved** (Lock) and **Remixes** (Scissors) when applicable. Remixes tab triggers separate `GET /api/clips/my-remixes` fetch. If tab counts haven't loaded, all tabs show without count badges (no "0" misleading users).

### Quick Export (Browse -> Render in Background)
Primary CTA on each card. Sends `POST /api/render/quick` with `x-idempotency-key` header (UUID, prevents double-clicks). API runs mood detection (best-effort), builds auto settings from preset, goes through render queue, returns `jobId`. Dashboard subscribes via `useRenderSubscription` and shows a completion toast with Download/View buttons. Auto-dismisses after 15s. Only one quick export at a time per user session (button disabled on other cards while rendering). The "Customize" button (sliders icon) still links to the full enhance page.

### Processing Status Badges (Posted / In Bank / Rendered)
Persistent indicators on card thumbnails showing whether the user has already processed a clip. Data: `GET /api/clips/my-status` returns `{ banked: string[], published: string[], rendered: string[] }` (three lightweight queries on `render_jobs` + `published_posts`). Fetched once via `fetchClipStatus()` in `trending-store.ts` (called from `fetchBootstrap`). Optimistic update on quick export done (`addRenderedClip`), publish (`markClipPublished`).

Badge priority (highest first): Posted (green `bg-emerald-500/20 text-emerald-300`, `✓ Posted`) > In bank (amber `bg-amber-500/15 text-amber-300`, `Archive` icon + `In bank`) > Rendered (grey `bg-white/10 text-white/60`, `Film` icon + `Rendered`). Small pill bottom-right of thumbnail.

### Bank = Explicit Autofarm Queue
The bank is the autofarm's publish queue. Clips enter ONLY by explicit user action ("Place in bank"). Renders are out-of-bank by default (`removed_from_bank_at = now()` at render_job creation). The semantics: `removed_from_bank_at IS NULL` = in bank. Bank queries use `.in('status', ['done', 'degraded'])` everywhere (hub loader, POST /api/distribution/bank, cron publish-scheduled, GET /api/clips/my-status) — degraded renders are publishable.

**Post-render dialog (UnifiedPublishDialog)** — three actions:
1. **Publish** (primary) — manual publish to selected platforms
2. **Place in bank** (secondary, amber) — calls `POST /api/distribution/bank`, subtitle "autofarm posts at optimal time"
3. **Later** + **Download** — render saved, clip out of bank, retrievable via Rendered badge on card or return to Enhance (kill-switch: `localStorage render-done:{clipId}` 24h TTL + server `GET /api/render/status?clip_id=`)

**Quota rule**: consumed at render time (unchanged). Bank/publish/later have no quota impact.

### Card Value Props
Each card shows concrete value beyond the raw score:
- **Human velocity**: "+12K/h views" (from `velocity` field, formatted with `formatCount`)
- **Insight tag**: always visible when `getClipInsight()` returns a result (High momentum, Early gem, Spike detected, etc.) + feed category badge (Hot/Gem)
- **Social proof**: "Used by N creators" or "Be the first to export" (from `export_count`)
- **Score number**: big Archivo Black overlay on thumbnail (unchanged)

### Detail Modal Score Breakdown
Opened via "Why this clip?" link on cards. Collapsible "Why this score" section (`trending-detail-modal.tsx`). Shows top 3 dominant scoring factors (sorted by value desc from momentum, authority, engagement, freshness, early signal, format). Each factor renders as a colored progress bar (green >= 70, amber 40-70, red < 40). Saturation penalty shown separately if > 30. Stats grid includes velocity ("/h") and export count. No extra API call — all data from `TrendingClip`.

### Stream Grouping
Clips from the same stream are grouped to prevent one streamer dominating the feed. Applied API-side in `GET /api/trending` after the DB query (post-processing, no extra queries).

**Detection**: same `streamer_id` + `clip_created_at` within 3 hours of each other. Minimum 3 clips to form a group.

**Algorithm**: group by `streamer_id`, sort by `clip_created_at`, merge adjacent clips within 3h gap. Sort each group by `velocity_score` desc — first clip is the "representative" (shown normally), clips 2+ are marked `stream_group_collapsed: true`.

**API response fields** (added to each clip, not in DB):
- `stream_group_id: string | null` — stable hash (`sg_{streamer_id_prefix}_{rounded_hour}`)
- `stream_group_count: number | null` — total clips in group
- `stream_group_collapsed: boolean` — true for non-representative clips

**Frontend**: representative card shows orange badge "N clips from this stream" with Layers icon. Click toggles `expandedGroups` Set in store -> `applyFilters()` shows/hides collapsed clips. Collapsed cards have an orange left border. Groups crossing page boundaries handled independently.

### Gotchas
- "Load more" deduplicates by clip ID before appending (prevents visual duplicates when scores shift between paginated requests)
- Video preview fetch delayed 500ms on hover — cancels if mouse leaves before timeout (prevents bandwidth waste on fast scrolling)
- Twitch video preview resolved via GQL; Kick uses HLS proxy (section 5)
- Search sanitized server-side: strips `%_\\'().,;`, max 100 chars
- On fetch failure, shows error message "Unable to load clips — try refreshing" (no silent seed fallback — errors are visible to the user)
- Low-tier cards (common/rare) render at `opacity-60` with `hover:opacity-100`
- DB indexes support cursor pagination: composite `(velocity_score DESC, id DESC)` and `(created_at DESC, id DESC)`, plus partial indexes on `feed_category`, `niche`, `next_check_at`, and a trigram GIN index on `title` (migration `20260424_feed_indexes.sql`)

### TikTok-Safe Content Filter

**Migration:** `20260830_content_risk_filter.sql` — adds `content_risk TEXT NULL` to `trending_clips` + `streamers`, and `allow_risky_content BOOLEAN DEFAULT FALSE` to `distribution_settings`.

**Detection** (`lib/scoring/content-risk.ts`): 3 layers, runs at clip import + re-score:
1. **Title keywords** (case-insensitive, word-boundary for short words): gambling (casino, slots, baccarat, blackjack, roulette, jackpot, stake, gamba, poker, parlay, degen, bonus buy, max win, pokies…), violence (fight, knockout, ko'd, brawl, beat up…), mature (strip, onlyfans, 18+, nsfw…)
2. **Streamer niche**: `streamers.niche` = 'gambling'/'slots'/'casino' → all clips inherit `content_risk = 'gambling'`
3. **Auto-learn**: if ≥60% of a streamer's last 20 clips are flagged by keywords → `streamers.content_risk` is set, future clips inherit the flag even without keywords

**3 protection layers:**
| Layer | Where | Behavior |
|---|---|---|
| **Browse UI** | `trending-card.tsx` | Amber badge "⚠ TikTok risk" + tooltip. "Hide risky clips" toggle in filters (client-side, `filters.hideRisky` in trending store) |
| **Publish dialog** | `unified-publish-dialog.tsx` | Warning before confirm: "TikTok restreint souvent ce type de contenu…" (user can proceed) |
| **Autofarm** | `cron/publish-scheduled` | Clips with `content_risk IS NOT NULL` are auto-canceled unless `distribution_settings.allow_risky_content = true`. Autofarm NEVER auto-posts risky content without explicit opt-in |

**Backfill:** `POST /api/admin/backfill-content-risk` (admin-only, batch 500) or direct SQL regex. Initial backfill: 20 gambling + 51 violence + 4 mature flagged out of ~19k clips.

### Easter Eggs (Score 67)
- **Rainbow badge**: Any clip with `Math.round(velocity_score) === 67` gets the `score-six-seven` CSS class — animated rainbow gradient text (defined in `rank-cards.css`, applied in `trending-card.tsx`). Landing radar slot 3 is a permanent static 67 card (Agent00 "Professor Agent teaches clip farming").
- **Server inclusion**: `GET /api/trending` — on first page of score sort (no cursor, no search), if no clip rounds to 67 in the result, a supplemental query fetches the freshest 67 (`velocity_score >= 66.5 AND < 67.5, ORDER BY clip_created_at DESC LIMIT 1`) and appends it (deduplicated by id). One lightweight extra query, score-sort only.
- **Sort float**: In the browse feed's "Score" sort (`trending-store.ts`), a clip displaying 67 is sorted as if it were 79 — it floats up near the top. Display value stays 67. (2026-08-25) **Disabled in capture mode** (`?capture=1` / sessionStorage `va:capture-mode`): promo recordings sort by real score, so the 67 sits at its natural position in the descending order. Client pagination dedupes by id — only one instance of the injected 67 ever renders.

---

## 2. Clip Scoring V2

7-factor engine ranking clips 0-100, with display curve, tier classification and feed categories.

### Files
- `lib/scoring/clip-scorer.ts` — `scoreClip(input): ClipScoreOutput`, all 7 factor functions

### Factors Summary
| # | Factor | Weight | Key Logic |
|---|--------|--------|-----------|
| 1 | Momentum | 25% | velocity + acceleration (or sublinear fallback `age^0.7`). Spike boost 1.5x if velocity > 2x streamer avg |
| 2 | Authority | 20% | clip views vs streamer avg, weighted by log(views). Neutral=60 if no data |
| 3 | Engagement | 15% | Bayesian smoothed: (likes+1)/(views+50). <30 views=neutral 50. Thresholds: >5%=100, >3%=80, >1.5%=60, >0.5%=40. Title boost capped +10%. Kick view freshness: rescore does NOT re-fetch — import-time only (backlog) |
| 4 | Recency | 10% | `exp(-age/72)*100`. 6h=92, 24h=72. Never 0 |
| 5 | Early Signal | 10% | views/min * log(views) * exp(-age/6). Short clip bonus 1.1x. Floor at 50 after 24h |
| 6 | Format | 10% | 15-45s=100, 45-90s=80, 8-15s=70, >90s=60, <8s=40 (calibrated 2026-07, Buffer 2025 1.1M videos) |
| 7 | Saturation | -10% | Penalty for old viral (>7d + >1M views) and dead clips (velocity < 50% streamer avg) |

### Display Curve & Anti-Gaming
`displayScore = -5 + clamp(rawScore) * 1.5`, capped at 95. All inputs pass through `safe()` (NaN/Infinity -> 0). Velocity capped at 50x streamer avg. Zero-likes on >10K views adds +30 saturation penalty. `diagnoseClip()` exported for debug.

### Rank Thresholds
`>=95` master, `>=80` legendary, `>=65` epic, `>=45` super_rare, `>=25` rare, `<25` common.

### Feed Categories
- `early_gem`: age < 6h AND (earlySignal >= 50 OR authority >= 70)
- `hot_now`: momentum >= 65 AND age < 12h
- `proven`: finalScore >= 55 AND age > 12h

---

## 3. Enhance / Edit Flow

Video enhancement page with AI mood detection, hook generation, live CSS preview and render trigger.

### Vertical Format & Crop Modes
Split-screen / b-roll is permanently removed (2026-08-12). Default is `auto` — smart crop selection based on content analysis. Six `videoZoom` modes:

| Mode | Behavior | When used |
|---|---|---|
| **auto** | Runs crop advisor: face analysis → picks fullframe, fit, or reaction automatically. | DEFAULT (all mood presets, enhance page) |
| **fullframe** | Center crop to 9:16 — no blurred padding. Scales source to fill canvas vertically, crops sides. Best for talking heads. | Auto-selected when dominant centered face detected |
| **fit** | Full image preserved, scaled to width. Deep cinematic blurred padding top/bottom (sigma=24, brightness=-0.45, saturation=0.5). Best for gameplay, IRL wide. | Auto-selected when no dominant face / wide content |
| **reaction** | Facecam top (~32%), content bottom (~68%), both full width. Webcam region cropped and scaled separately. | Auto-selected when reaction layout detected |
| **fill** | Clip scaled 115% over blurred-pad background. Some blur visible at edges. | Manual only |
| **immersive** | Clip scaled 135% over blurred-pad. Minimal blur visible. | Manual only |
| **contain** | Clip fit inside canvas with light-blur background pad (old default). | Manual only |

#### Smart Crop Selection (`vps/lib/crop-advisor.js`)
Runs on trending clips when `videoZoom=auto`. Uses face-detect.py (every 20 frames, 12s timeout):

| Condition | Result |
|---|---|
| Reaction layout detected (webcam in corner) | → `reaction` |
| Source already vertical (h >= w) | → `fullframe` (natural fit) |
| No face detected (<15% detection rate) | → `fit` (gameplay, wide content) |
| Face detected, large + centered (score >= 0.55, centering >= 0.4) | → `fullframe` |
| Face detected but not dominant enough | → `fit` |
| Analysis failure / timeout | → `fit` (safe fallback) |

Face score (0-1) = face size (up to 0.35) + centering (up to 0.25) + detection rate (up to 0.2) + stability (up to 0.2).

#### Blurred padding styles
- **fit mode**: deep cinematic — downscale /4 → `gblur=sigma=24` → `eq=brightness=-0.45` → `hue=s=0.5` → upscale bilinear. CSS preview: `blur(20px) brightness(0.45) saturate(0.5)`. Neutral texture, not recognizable content.
- **contain/fill/immersive**: lighter — `gblur=sigma=6` → `eq=brightness=-0.45` → `hue=s=0.85`. CSS preview: `blur(14px) brightness(0.55) saturate(0.85)`.

Source UI removal: all modes apply a border crop (100px for fullframe/reaction, 60px for others) to strip Twitch/Kick stream overlays.

#### Originality on fit clips
Fit mode loses the fullframe crop originality signal. Compensated by ensuring smart zoom (micro/dynamic), voiceover, and audio fingerprint shift (+3%) are all active on the fit path — same pipeline, different composition step.

#### Enhance UI
Framing section (Crop icon) in the enhance accordion shows 3 options: Auto (recommended), Full frame, Fit (padded). Auto shows the VPS-chosen mode after render. User can force any mode to override.

### Reaction Layout Detection
Automatically detects "reaction" clip layouts (small webcam overlay in a corner over main content) and recomposes them as a vertical stack: facecam on top (~32%), content on bottom (~68%), both at full canvas width.

**Detection** (`vps/lib/layout-detector.js`):
- Runs `face-detect.py` (OpenCV Haar cascade) on the source with coarse sampling (every 30 frames), 10s timeout
- Only applies to horizontal sources (16:9) — vertical sources skip detection
- Heuristic scoring (0-1 confidence) based on: face in corner quadrant (+0.5), moderate detection rate (+0.2), widescreen aspect (+0.15), low positional variance (+0.15)
- Threshold: confidence >= 0.6 → reaction layout confirmed
- On failure or low confidence → crop advisor continues to fullframe/fit decision

**Auto-switching**: when `videoZoom=auto`, the VPS runs layout detection first, then crop advisor. If reaction layout is detected, crop advisor returns `reaction`. If not, it analyzes face dominance to pick `fullframe` vs `fit`. User can force any mode in the Enhance UI.

**FFmpeg composition** (`vps/lib/ffmpeg-render.js`):
- Facecam region: cropped from detected face corner, scaled to fill canvas width, cropped to 32% of canvas height
- Content region: full source with border crop, scaled to fill canvas width, cropped to 68% of canvas height
- Stacked via FFmpeg `vstack=inputs=2`
- Captions render on the content zone (bottom), never over the face

### UI — Sliders
All 7 sliders (caption position, words/line, tag size, split ratio, hook position, silence threshold, auto-cut) use the unified `components/ui/slider.tsx` (shadcn-style). Single branded style: `bg-white/10` rail, amber gradient fill (`from-amber-400 to-amber-600`), amber thumb with glow + `hover:scale-110`, accessible focus outline. No per-instance overrides.

### UI — Selects
All user-facing selects use the unified `components/ui/select.tsx` (custom shadcn-style, not Radix). Single branded style: trigger `bg-black/30 border-white/10 text-white hover:border-white/25 focus:ring-amber-500/50`, built-in chevron `text-white/40`, dropdown `bg-[#0f172a] border-white/10 shadow-lg`, items `hover:bg-amber-500/15 hover:text-amber-200`, selected check `text-amber-400`. Click-outside + Escape to close. Converted selects: browse streamer filter (`trending-filters.tsx`), TikTok privacy in publish dialog (`tiktok-publish-dialog.tsx`, no-default preserved), autofarm defaults in distribution hub (`distribution-hub.tsx`, inline styles removed), signup acquisition source (`signup/page.tsx`). Admin selects untouched.

### User Flow
1. Arrive at `/dashboard/enhance/{clipId}` -> load clip from `trending_clips` or `videos`
2. Toggle settings manually OR click "Make it viral" (AI auto-optimization)
3. "Make it viral" -> mood detection (Claude Haiku, 15s timeout) -> hook generation (VPS, 15s) -> auto-render
4. Live CSS preview updates in real-time; "Generate clip" triggers render pipeline
5. On completion: download, publish, or Before/After compare mode

### Files
- `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` — main state machine, all settings, render flow
- `lib/enhance/scoring.ts` — `EnhanceSettings` type, `computeScores()`, `computeCurrentScore()`
- `lib/enhance/feature-flags.ts` — `COMING_SOON_FEATURES`: features frozen for launch (smartZoom, hookReorder). Weights redistributed to remaining features. Re-enable by emptying the array.
- `components/enhance/live-preview.tsx` — CSS-rendered preview: caption animation, split-screen, tags, smart zoom
- `lib/ai/mood-detector.ts` — Claude Haiku call (model: `claude-haiku-4-5-20251001`)
- `lib/ai/mood-presets.ts` — 6 moods (rage, funny, drama, wholesome, hype, story) with per-platform adaptation
- `lib/capture-hook-overlay.ts`, `lib/capture-tag-overlay.ts` — Canvas-based PNG capture for VPS

### State Machine (`EnhanceState`)
Explicit state machine in `enhanceState` + `enhanceError`:

`idle` -> `detecting_mood` -> `applying_preset` -> `generating_hooks` -> `rendering` -> `done` | `error`

- Each step wrapped in try/catch — errors set `enhanceState='error'` + `enhanceError` message
- Visual feedback banner shows current step (Loader2 + label) or error (AlertCircle + Dismiss button)
- Timeout recovery: if stuck in `detecting_mood` or `generating_hooks` > 60s, auto-transitions to `error`
- Legacy `makeViralLoading` bool preserved for the "Make it viral" button disabled state

### Shared Render Schema
**File:** `lib/schemas/render.ts` — Zod schema `renderSettingsSchema` + `renderInputSchema`. Single source of truth used by `/api/render`, `/api/render/quick`, and the frontend `handleRender()`. Mirrors the VPS contract. Includes `audioEnhance.bassBoost` (`off`/`mild`/`heavy`) and `audioEnhance.speedRamp` (`off`/`subtle`/`dynamic`).

### Caption Font Size (Render Parity)
**VPS file:** `vps/lib/subtitle-generator.js` — `CAPTION_STYLES` object + `adjustPositioning()`.

Base font sizes are calibrated against the UI live-preview (`components/enhance/live-preview.tsx`):
- Preview container: 310px wide (9:16 ratio). Highlight = `text-sm` (14px), Word-Pop = `text-lg` (18px).
- VPS canvas: 1080×1920. Highlight (hormozi) = 78px, **Word-Pop = 100px** (dedicated style, 1.29× highlight matching the UI 18/14 ratio).
- `adjustPositioning()` scales fontsize by `max(0.75, canvasHeight/1920)` — keeps proportions on 720p fallback tiers.

The `word-pop` style now has its own entry in `CAPTION_STYLES` (previously fell back to `hormozi` silently, losing the size differential).

### Bass Boost & Speed Ramp
**VPS file:** `vps/lib/ffmpeg-render.js` (`buildBassBoostFilters`, `buildSpeedRampFilters`)
- **Bass boost mild**: `bass=g=4:f=80:w=100` + `acompressor` + `alimiter`. Heavy: `bass=g=8:f=60:w=120` + stronger compression + limiter. Always ends chain with `alimiter=limit=0.95` to prevent clipping.
- **Speed ramp subtle**: `setpts=PTS/1.03` (video) + `atempo=1.03` (audio). Dynamic: 1.05x. Changes clip duration — subtitle timestamps must be divided by the speed factor.
- Scoring: mild bass = +0.03, heavy = +0.05; subtle speed = +0.02, dynamic = +0.03

### Silence Cut (auto-cut, enabled by default)
**VPS files:** `vps/lib/auto-cut.js` (`computeSpeechSegments`, `applyAutoCut`), `vps/lib/audio-peaks.js`

Enabled by default on all mood presets and Quick Export. Detects silences > 1.2s in the Whisper word timestamps and cuts them, with 150ms padding on each side to avoid cutting mid-word.

**Safety**: never removes more than 40% of the clip. Never produces a result shorter than 3s. If either limit is hit, auto-cut falls back to **peak-window trimming**: uses `detectPeakMoment` (Smart Hook) to find the most intense moment, then trims a 25-40s window around it (peak positioned at 1/3 of the window for a front-loaded hook). Word timestamps are remapped to the trimmed window. Only if the clip is <=25s or peak detection fails does the original clip survive uncut. Log: `AUTO-CUT FALLBACK: trimmed to peak window Xs-Ys`.

**Sync**: after cutting, all timestamps are remapped to the new compressed timeline — captions (ASS file regenerated), voiceover lines, and the clip timeline all stay synchronized. The remap matches words to kept segments in the same coordinate system (no clipStartTime adjustment — both words and segments are derived from the same Whisper timestamps). Log: `AUTOCUT REMAP: X words in → Y words out`.

**UI**: "Silence Cut" accordion in Enhance page. Toggle + threshold slider (default 1.2s). Shows "cuts gaps > 1.2s" in the header.

### Free Plan: End-Card (replaces persistent watermark)
Free plan no longer has a persistent `@viralanimal` watermark during playback — TikTok flags permanent logos/watermarks as "unoriginal content". Instead, a 1.5s end-card is appended after the clip (dark bg, "Made with VIRAL ANIMAL", viralanimal.com). Same attribution, zero penalty during content.

Pro/Studio: no end-card, no watermark (paid advantage preserved).

### Viral Score Formula
`currentScore = baseline + (headroom * totalWeight)`. Baseline = `max(30, clip.velocity_score)`. Weight accumulates per enabled feature (captions 0.14, hook 0.13, split-screen 0.07, etc.) with mood-match bonuses (~0.19 max). Cap at 99. Poids calibres par recherche — voir `docs/research/viralite-calibration.md`.

### Render Contract & Degraded Status

Every render builds a **contract** (`vps/lib/render-contract.js`): a list of features the user requested and what was actually applied. Stored in `render_jobs.contract` (JSONB column, migration `20260824_render_contract.sql`).

**Feature classification:**
- **Critical** (trigger `degraded` + refund): `voiceover`, `captions`, `hook_text`
- **Cosmetic** (logged but no refund): `audio_shift`, `smart_zoom`, `audio_enhance`, `crop_mode`, `auto_cut`

**Flow:**
1. `createContract(settings)` at render start — builds entries from settings
2. Each pipeline step calls `contract.record(feature, applied, reason)`
3. `contract.evaluate()` at end — if any critical feature was requested but not applied → `isDegraded: true`
4. VPS sets status to `degraded` instead of `done` and sends webhook
5. Next.js webhook handler: `degraded` → clip delivered + quota refunded + user sees warning ("Rendered without AI voiceover — credit refunded")

**Consecutive failure tracking:** if the same feature fails on 3+ consecutive renders, Discord `#critical-alerts` fires with the feature name and reason. Success resets the counter.

**Admin API:** `GET /api/admin/render-contracts` — 7-day feature application rates, sorted worst-first. Shows total/degraded job counts. Admin-only.

**Golden Render Test:** `scripts/audits/golden-render-test.ts` — nightly audit that checks the 3 most recent renders for contract compliance + 7-day feature rates. Posts to Discord, stores in `audit_metric_snapshots`.

### Render Quality (4-tier ladder)
Env var `RENDER_QUALITY` (default `high`). Auto-fallback on OOM (exit code null/137):
- **HIGH_60**: 1080p60, fast, crf 17, maxrate 15M, audio 256k — target ≤120s for 30s clip
- **HIGH_30**: 1080p30, fast, crf 18, maxrate 10M, audio 256k
- **SAFE**: 720p30, faster, crf 22, maxrate 6M, audio 192k
- **LAST_RESORT**: 720p30, ultrafast, crf 26, maxrate 4M, audio 160k

Quality tier is stored in `render_jobs.quality_tier` and exposed via `/api/render/status` as `qualityTier` + `reducedQuality` boolean. If tier < HIGH_30, the Enhance page shows a "Rendered at reduced quality" warning. `execRender()` receives `tierName` as 4th param from both `renderClip` and `renderSplitScreen` loops.

Filtergraph: scale/crop → eq (4 buckets) → unsharp (HIGH only) → ASS subtitles → overlays → watermark → format. `escapeDrawtext()` uses `'\''` (close-escape-reopen) for apostrophes in user text (hook, tag author) — FFmpeg does not process `\'` inside single-quoted filter values. Details : `SYSTEM-REFERENCE-ENHANCE.md` section "Qualite de rendu v2".

### Hook Capsule Parity (preview ↔ render)
`vps/lib/ffmpeg-render.js`: the hook capsule overlay is anchored by its **top** edge at `posPct%` of the video height — matching the CSS preview (`top: posPct%`). The 116 px glow padding baked into the browser-captured PNG is offset so the visible capsule aligns. On downgraded tiers (SAFE / LAST_RESORT = 720p), the browser PNG is rescaled proportionally instead of being placed at its native 1080p size.

### Peak Detection (spike + positional prior)
`vps/lib/hook-generator.js` > `detectPeakMoment()`. Combines audio spikes (x8), viral keywords (+3/+2/+1), ALL CAPS (+2), positional prior (Twitch/Kick clips: last 1/3 boosted x1.3), anti-edge. Word-boundary snapping for hook reorder.

### Smart Zoom — Face Follow vs Micro Push

Two modes, auto-selected based on face detection results:

| Mode | When | What it does |
|---|---|---|
| **follow** | Face detected on >=60% of sampled frames | Real face tracking — 1.20x zoom, smooth pan following the subject. Dead zone (10% center), max speed limit (3%/sample), 0.94 inertia. Camera feels like a calm cameraman. |
| **micro** | No stable face, or face tracking disabled | Slow cinematic push 1.0 → 1.06 over clip duration. Barely noticeable drift. |
| **dynamic** | Explicit user selection | Punch zooms on audio peaks (5% amplitude, 3 max). |

**Auto-selection flow** (VPS render route):
1. Crop advisor runs face detection (every 20 frames) for framing decision
2. If crop recommends `fullframe` or `fit` (face present), face tracker runs again at full resolution (every 10 frames, 15s timeout)
3. If detection rate >= 60% → auto-upgrade to `follow` mode with pre-computed keyframes
4. If detection rate < 60% or error → stay on `micro`

**Python smoother** (`vps/lib/face-detect.py`):
- Dead zone: camera ignores face movement within 10% of canvas center (prevents jitter)
- Max speed: camera moves at most 3% of canvas diagonal per sample (prevents snaps)
- Heavy inertia: 0.94 (very smooth — higher = slower response)
- Gap fill: face disappears → camera holds at last position (no drift)
- Rule of thirds: face offset down 8% (room for captions/hooks at top)

**FFmpeg filter** (`buildFollowFaceFilter`):
- 1.20x scale-up → piecewise linear crop pan with up to 20 keyframes
- Keyframes downsampled from full detection set to keep FFmpeg expression sane
- Fallback: if <2 keyframes → micro push

### Hook Text Generation (content-aware)
`vps/lib/hook-generator.js` > `generateHookTexts()`. Claude Haiku writes 3 hooks (shock/curiosity/suspense) that reference the specific clip content. **No generic templates** — generic phrases like "nobody expected this", "wait for it", "legendary moment" are explicitly banned in the prompt.

**Data flow**: Enhance page sends `title` (strongest signal for trending clips) + `clip.description` + `streamerName` + `niche` to VPS `/hook` endpoint. VPS runs peak detection first, then passes `peakTranscript` (5s around the detected peak) to Claude alongside the title. Claude must produce hooks that mention something from the actual content.

**Fallback strategy** (no generic templates):
1. Claude succeeds: content-aware hooks referencing clip title/transcript
2. Claude fails (API error, parse error, timeout): title-based fallback — clip title uppercased + emoji. Still specific to this clip.
3. No title and no transcript available: returns `null` — hook is disabled entirely. No hook is better than a generic hook.
4. Consecutive fallback tracking: if >= 3 fallbacks in a row, Discord alert to `#critical-alerts` (likely ANTHROPIC_API_KEY issue on VPS)

Each fallback logs a distinct reason: `no_api_key`, `no_content`, `api_error`, `parse_error`, `json_parse_error`, `invalid_structure`, `timeout`, `network_error`.

### Paywall (contextual conversion)
Free plan: 3 videos/month. On quota hit (client-side check uses `PLANS[plan].limits.maxVideosPerMonth`) → PaywallModal with 5 options: one-time save (first wall only), upgrade, invite (+5/+2 clips at signup), top-up packs ($5/5, $9/10), wait. Server 402 `quota_exceeded` also opens PaywallModal. Strategy : `docs/research/freemium-paywall-strategy.md`.

### Clip Duration Limits (per-plan)
Max clip duration: Free 60s, Pro/Studio 120s. Enforced server-side (`checkClipDuration` in `lib/plans.ts`) — API returns 402 `clip_too_long` with `{ currentUsage, limit, plan }`.

**Upfront prevention** (no wasted time configuring a clip that can't render):
- **Browse cards**: duration badge turns soft red (`text-red-300 bg-red-500/20`) with "Too long for your plan" tooltip when `clip.duration_seconds > maxClipDuration`. `maxClipDuration` derived from `userPlan` in trending store via `getPlanConfig`.
- **Enhance page**: Generate button disabled with amber explanation block when `clip.duration_seconds > plan limit`. Free plan shows "Upgrade for 2-minute clips" CTA. Pro/Studio shows "Pick a shorter clip".

**Post-render error** (server-side catch, in case duration wasn't known upfront): dedicated amber state (not red ErrorCard), shows exact duration vs limit, same upgrade/pick-shorter logic. No misleading Retry button.

**First clip overlay + Quick Export**: separate `clip_too_long` toast/message (no longer grouped with `quota_exceeded`).

### Watermark + End-Card (free plan)
Next.js render routes send `plan` + `watermark: { enabled: plan==='free' }` in the VPS payload. VPS uses the payload plan (fallback: DB lookup). Free plan: `@viralanimal` drawtext watermark (position-alternating top/bottom center, anti-crop) + 1.2s end-card ("clipped with VIRAL ANIMAL"). Pro/Studio/comp: no watermark, no end-card.

### API Endpoints
- `POST /api/enhance/ai-optimize` — mood detection. Returns `{ mood, confidence, explanation, important_words }`
- `POST /api/render/hook` — proxied to VPS. Returns `HookAnalysis { peak, hooks[3], reorder }`

### Deleted Clip Detection (CLIP_DELETED)
When a source clip has been removed by the streamer or platform:
1. **VPS download** (`vps/routes/render.js` `downloadFromUrl` + `vps/lib/yt-dlp-wrapper.js`): detects yt-dlp errors ("no longer available", "HTTP Error 404", "Video unavailable") and direct fetch 404/410. Throws `Error('CLIP_DELETED: ...')` — no fallback, no retry.
2. **Webhook** (`app/api/render/hook/route.ts`): on CLIP_DELETED error, skips retry loop and marks `trending_clips` row as `tier='dead', feed_category='normal', next_check_at=null`.
3. **Render status** (`app/api/render/status/route.ts`): returns dedicated message for CLIP_DELETED errors.
4. **Frontend** (`components/ui/error-card.tsx`): `classifyError` detects CLIP_DELETED → `ErrorKind='clip_deleted'` (Trash2 icon, zinc color). Enhance page shows "Ce clip a été supprimé par le streamer ou la plateforme — choisis-en un autre" with no Retry button.
5. **Rescore cron** (`app/api/cron/rescore-clips/route.ts`): checks `render_jobs` for CLIP_DELETED errors on current batch, marks matching trending_clips as dead, removes them from bulk score update.

### Gotchas
- Mood detection falls back to "hype" at 30% confidence on timeout/error
- Overlay capture uses Canvas only (SVG foreignObject taints canvas, breaks toDataURL)
- `sessionStorage` persists `render-job:{clipId}` for resume on page refresh
- Changing any setting while `isRenderedVideo=true` reverts to CSS preview mode

---

## 4. Render Pipeline

Async flow: UI settings -> VPS FFmpeg -> Supabase Storage -> signed URL, with Realtime subscription.

### Flow (two entry points)
**Full render** (`POST /api/render`): Client captures overlay PNGs -> sends settings -> Zod validation, quota check, queue, VPS handoff.
**Quick export** (`POST /api/render/quick`): 1-click from Browse card -> auto mood detection + preset settings -> same queue + VPS flow. Supports `x-idempotency-key` header (Redis, 5min TTL) to prevent double-clicks.

1. API: Zod validation, idempotency check, quota check (RPC `increment_video_usage`), resolve clip URL, create `render_jobs` row
2. **Render queue** (`lib/render-queue.ts`): checks active count in Redis. If slot available -> fire-and-forget to VPS. If full -> store payload in Redis, add job to queue, return `{ queued: true, queuePosition: N }`
3. VPS (Railway): FFmpeg processes, uploads to Supabase Storage `clips/` bucket, updates `render_jobs` directly
4. Client: `useRenderSubscription` receives Supabase Realtime update OR falls back to polling
5. When `GET /api/render/status` detects `done`/`error` -> calls `processNextInQueue()` to dispatch next queued job

### Render Queue (Upstash Redis)
- **File:** `lib/render-queue.ts`
- **Keys:** `render:active_jobs` (Set of active job IDs), `render:started:{jobId}` (per-job TTL 900s — orphan detection), `render:queue` (FIFO list), `render:payload:{jobId}` (stored settings, TTL 1h)
- **MAX_CONCURRENT:** `RENDER_MAX_CONCURRENT` env var (default 3)
- **QUEUE_MAX_SIZE:** 50 — returns 429 if full
- Job lifecycle: `pending` -> `queued` (if no slot) -> `rendering` (VPS picks up) -> `done` | `error` (retriable) | `failed` (dead letter) | `canceled` (force re-render) | `expired` (storage TTL elapsed)
- **Canonical statuses** (CHECK constraint): `pending | queued | rendering | done | error | failed | canceled | expired` — US spelling 'canceled' (single L)
- Safety: active jobs tracked via Redis Set (idempotent SREM — no counter drift). Each job has a `render:started:{jobId}` key with 900s TTL, renewed by heartbeat. Reconciler cron removes stale entries every 30min
- Functions: `enqueueRender()` (SADD), `releaseJob()` (SREM, idempotent), `processNextInQueue()` (dispatch from queue), `removeFromQueue()` (LREM + del payload — use when finalizing outside normal flow), `cleanupPayload()` (del payload on terminal state), `getQueueStatus()` (SCARD)
- **Payload lifecycle:** stored in Redis at enqueue time (`render:payload:{jobId}`, TTL 1h). Kept alive through retries. Deleted ONLY when job reaches terminal state (done/failed) via `cleanupPayload()` in webhook handler, or via `removeFromQueue()` in reconcile/cleanup crons. Never deleted at dispatch time.
- **Queue purge:** `removeFromQueue()` called by reconcile + cleanup crons to prevent cancelled/timed-out jobs from being resurrected by a later dispatch
- **VPS-side queue:** entire pipeline (download + Whisper + FFmpeg + upload) runs inside the VPS in-memory queue (MAX_CONCURRENT=1). Gate: 10-job max waiting, 409 on duplicate jobId
- **Disk cleanup (VPS):** boot purge + hourly `purgeStaleDirs()` removes TEMP_DIR/OUTPUT_DIR entries > 2h old

### Files
- `app/api/render/route.ts` — validation, quota, queue check, VPS handoff, force re-render
- `app/api/render/quick/route.ts` — skip enhance, auto mood + settings
- `app/api/render/status/route.ts` — poll status, signed URLs, VPS queue position probe, **dispatches next queued job on completion**
- `app/api/render/hook/route.ts` — hook text generation (proxied to VPS) + VPS webhook (retry/dead-letter)
- `app/api/render/heartbeat/route.ts` — VPS heartbeat to keep long renders alive
- `hooks/use-render-subscription.ts` — Realtime subscription (channel `render-jobs`) + polling fallback with adaptive backoff (3s -> 5s -> 10s -> 30s)
- `lib/render-queue.ts` — `enqueueRender()`, `releaseJob()`, `processNextInQueue()`, `getQueueStatus()`
- `lib/api/render-helpers.ts` — shared: `resolveClip()`, `checkExistingJob(force?)`, `enforcePlanLimits()`, `createRenderJob()`, `sendToVps(admin, jobId, userId, payload)`
- `lib/api/dispatch-render.ts` — `processAndDispatchNext(admin)` — unified pop+dispatch (the ONLY correct way to process queued jobs)

### Heartbeat (VPS -> API)
**Route:** `POST /api/render/heartbeat` (auth via `x-api-key: VPS_RENDER_API_KEY`)
- VPS sends `{ "jobId": "..." }` every 60s during a render
- Verifies job exists and is in `rendering` status
- Renews `render:started:{jobId}` TTL to 900s + sets `render:heartbeat:{jobId}` with 120s TTL
- Prevents the zombie cleanup cron from killing long renders (>10min)

### Retry & Dead-Letter
When the VPS webhook (`hook/route.ts`) reports `status: 'error'`:
1. If `retry_count < max_retries` (default 2): job re-queued with `retry_count += 1`
2. If `retry_count >= max_retries`: job marked `failed` (dead letter) with final error message
- DB columns: `retry_count` (default 0), `max_retries` (default 2) — migration `20260425_render_retry.sql`

### Idempotency
- **Key-based** (`/api/render/quick`): frontend sends `X-Idempotency-Key` header. API checks Redis — returns existing job if found.
- **DB-based** (both `/api/render` and `/api/render/quick`): `checkExistingJob()` queries render_jobs for pending/rendering/queued jobs for same clip+user. Returns existing job instead of creating duplicate.
- **Force re-render** (`force: true` in POST body): cancels stuck jobs for this clip+user, frees Redis slots, creates fresh job

### Quota & Refund Policy
- `increment_video_usage` RPC consumes a credit BEFORE render starts
- Duration limits: free=30s, pro=5min, studio=unlimited
- **Refund rule**: a credit is ONLY consumed if the render finishes `done`. All other outcomes refund via `refund_video_usage`:
  - VPS not configured → refund immediately
  - Job creation failure → refund immediately
  - Queue full → refund immediately
  - VPS unreachable (sendToVps error) → refund + release slot
  - Zombie cleanup (pending/queued/rendering timeout) → refund
  - Stuck in queue >30min (reconciler) → refund
  - Max retries exhausted (finalStatus=failed) → refund
  - Degraded render (critical feature missing) → refund
- All `refund_video_usage` calls are `await`ed with error checks (no fire-and-forget `.catch()`)
- UI: `monthlyUsed` counter incremented client-side on render done

### Atomic RPC Functions (migration `20260830_atomic_bonus_and_affiliate.sql`)
- `add_bonus_videos(p_user_id, p_count)` — atomic `bonus_videos += p_count` (used by Stripe webhook top-up, referral rewards)
- `increment_affiliate_conversion(p_affiliate_id, p_revenue, p_commission)` — atomic affiliate totals update (used by Stripe webhook on conversion)
- `grant_paywall_save(p_user_id)` — atomic one-time paywall save: `UPDATE ... WHERE paywall_save_used IS NOT TRUE`, returns boolean (used by `POST /api/paywall/save`)

### Unified Queue Dispatch
- All 4 call sites (status, hook, reconcile, cleanup) use `processAndDispatchNext(admin)` from `lib/api/dispatch-render.ts`
- `processNextInQueue()` should NEVER be called directly without dispatch — `processAndDispatchNext` wraps it correctly
- Both `/api/render` and `/api/render/quick` use `enqueueRender()` for slot management

### Timeouts
- **Pending/queued**: 10 minutes (based on `created_at`) — VPS never picked up the job
- **Rendering**: 15 minutes hard timeout (based on `updated_at`) — independent of heartbeat. Even if heartbeat ran at minute 14, if minute 16 is reached the job is killed

### Dependencies
- VPS: `VPS_RENDER_URL` (Railway) — authenticates with `VPS_RENDER_API_KEY`
- Supabase Storage: `clips/` for output, `thumbnails/` for thumbnails
- Supabase Realtime: postgres_changes on `render_jobs` table
- yt-dlp: pinned in `vps/Dockerfile` `ARG YT_DLP_VERSION=2026.07.04`. Bump when Twitch/YouTube break extractors. Watchdog `checkYtdlpExtractor()` probes `GET /api/health/ytdlp` (30s timeout, known Twitch clip) and alerts Discord if broken.

### Adaptive Exposure (4 buckets)
VPS probes average luma of source video and applies eq filter: <65 luma (dark: b=0.035 c=1.08), 65-95 (dim: b=0.015 c=1.05), 95-140 (normal: c=1.02), >140 (no eq). Gentler than before to survive TikTok re-encode.

### Bright First Frame (TikTok thumbnail fix)
TikTok profile thumbnail = frame 1 of the video. Dark openings → invisible thumbnails → no clicks from profile.
VPS probes the opening luma (first 10 frames via `signalstats`). If average Y < 16/255, applies a progressive exposure lift on the first 0.5s only: `eq=brightness='0.25*(1-min(t/0.5,1))':eval=frame:enable='lte(t,0.5)'`. Frame 1 gets +0.25 brightness, fading to 0 by t=0.5s. Rest of clip untouched. Decision logged in `debug_log` via `BRIGHT_FIRST_FRAME` trace line. Applies in both standard and split-screen render paths, after global exposure correction (Step 3b).

### TikTok Originality — What the Pipeline Transforms

TikTok flags videos as "Unoriginal, low-quality content" when they appear to be imported/copied without creative edits. The render pipeline applies multiple real transformations to produce genuinely new content:

| Layer | What it does | Why it matters |
|---|---|---|
| **Smart crop** (auto default) | Crop advisor picks fullframe (face), fit (gameplay), or reaction — never blindly center-crops wide content | Fullframe avoids blurred bars (repost signature); fit preserves content with deep neutral blur (sigma=24, sat=0.5) |
| **Source UI removal** | 100px border crop strips Twitch/Kick overlays (chat, alerts, logos) | Platform UI is a clear signal of copied content |
| **Audio fingerprint shift** | +1.8-4.2% asetrate/atempo (diversified per render) | Changes audio hash — defeats audio duplicate detection |
| **Karaoke captions** | ASS subtitles burned at render time (word-pop, bounce, glow, highlight) | Major creative edit — changes the visual frame entirely |
| **Smart Zoom** (auto: face follow or micro push) | Follow mode: real face tracking with 1.20x zoom + smooth pan. Micro: cinematic push 1→1.06. Auto-selected based on face presence. | Camera movement = creative edit, not present in source |
| **Hook text overlay** | Animated capsule with fade in (0.3s) + auto-hide after 4s (0.3s fade out) | Adds original text content to the frame |
| **Exposure correction** | Adaptive eq filter based on source luma | Alters the color grading of every frame |
| **Credit tag** (credit-text style) | Plain "@handle" text with shadow, fades after 4s | NOT a watermark — looks like native TikTok text overlay |
| **Reaction layout recomposition** (auto-detected) | Detects webcam overlay, restacks facecam top + content bottom at full width | Complete spatial recomposition — fundamentally different frame than source |
| **AI Voiceover** (active by default) | Original commentary lines synthesized via ElevenLabs, mixed with ducking | TikTok explicitly accepts "original voiceover" as creative transformation |
| **Quality re-encode** | 1080x1920, CRF 17, libx264 high profile, bt709 color | Full re-encode — every frame is regenerated |

**Honest disclaimer**: these transformations produce genuinely edited content, but TikTok's Community Guidelines compliance also depends on the user's clip choice (e.g. music copyright, content rights). The pipeline does not guarantee For You feed eligibility for every clip. Users re-posting content they don't own should add significant creative value.

**Quality gate**: VPS logs a `LOW_RES_WARNING` when source resolution is below 720p. Output is always 1080x1920 (HIGH tier) or 720x1280 (SAFE/LAST_RESORT fallback), never upscaled from a visibly low-quality source without logging.

### Render Diversification (Anti-Duplicate Between Users)

When multiple users remix the same clip with similar settings, TikTok's perceptual hashing detects duplicates and penalizes later posters. Every render is made unique via seedable micro-variations derived from `jobId` (SHA-256 → deterministic PRNG).

**Principle (non-negotiable)**: render-parity — variations NEVER contradict user-configured settings. Only micro-parameters the user didn't explicitly choose are varied.

**Files:** `vps/lib/diversify.js` (seed + params), `vps/routes/render.js` (integration), `vps/lib/ffmpeg-render.js` (audio/zoom/grain), `vps/lib/subtitle-generator.js` (caption offsets), `vps/lib/elevenlabs-client.js` (voice pool)

| Parameter | Range | Where Applied |
|---|---|---|
| **Entry trim** | 0-1.2s (0.1s steps) | `render.js` — shifts clipStartTime, remaps word timestamps. Skipped if hook reorder active or result < 5s |
| **Audio shift** | +1.8% to +4.2% | `ffmpeg-render.js` `buildAudioShiftFilters` — replaces fixed +3% |
| **Caption position** | ±3% marginV | `subtitle-generator.js` — applied after `adjustPositioning` |
| **Caption size** | ±6% fontsize | `subtitle-generator.js` — applied after `adjustPositioning` |
| **Caption accent color** | 5-variant palette per style | `diversify.js` `getDiversifiedAccentColor` — only styles with non-white accent. Skipped if user set custom colors |
| **Voiceover voice** | 6-voice pool per register | `diversify.js` `pickVoice` + `elevenlabs-client.js` — same energy register (default/female/deep) |
| **Hook position** | ±4% vertical | `ffmpeg-render.js` — overlay Y adjusted |
| **Hook size** | ±5% scale | `ffmpeg-render.js` — hookScale multiplied |
| **Hook timing** | 0-0.4s delay | `ffmpeg-render.js` — fade-in start shifted |
| **Zoom amplitude** | ±15% of default | `ffmpeg-render.js` `buildSmartZoomFilter` — micro (0.06 base) and dynamic (0.05 base) |
| **Zoom phase** | 0-15% offset | `ffmpeg-render.js` — micro zoom curve start shifted |
| **Invisible grain** | noise strength 1-2 | `ffmpeg-render.js` — `noise=alls=N:allf=t` before final format conversion. Imperceptible but pixel-unique |
| **Hook text** | Non-deterministic (Claude temperature=1.0) | `hook-generator.js` — no explicit temperature → default 1.0. Two users get different hooks naturally |

**Debug log**: `DIVERSIFY: seed=X variations={...}` logged at start, `DIVERSIFY SUMMARY` lists all applied values before render. Entry trim logs remapped word count. Fully reproducible from seed for debugging.

### Burned-In Caption Detection & Crop Anchoring

**VPS files:** `vps/lib/caption-detector.js` (Haiku vision), `vps/routes/render.js` (detection + anchor logic), `vps/lib/ffmpeg-render.js` (anchor in all crop modes)

**Detection:** extracts 3 frames (25/50/75% of duration), crops bottom third + center third of each, sends to Claude Haiku vision to detect burned-in subtitles. Returns `{burned_captions, position, confidence}`. Runs on trending clips only when user captions are enabled.

**When burned captions detected (conf >= 0.7):**
1. **User captions disabled** — `settings.captions.enabled = false`, prevents doubling. Contract records `reason: 'source_has_burned_captions'` with `intentional: true` (no degraded status, no refund).
2. **Crop anchored to preserve source captions** — `cropAnchor` set to `'bottom'` (or `'top'` if pos=top). Affects ALL crop stages:
   - **Border crop:** vertical crop shifted to the opposite edge (e.g., bottom anchor → all vertical border crop from top, Y offset = `borderCrop * 2`)
   - **Fullframe/smartZoom final crop:** anchored Y (`ih-canvasH` for bottom, `0` for top)
   - **Reaction layout content crop:** border trim uses `borderCropY`, final aspect crop uses anchored Y (`ih-contentH` for bottom). Facecam crop unchanged (uses exact face region coords).
   - **Smart zoom (dynamic/micro):** crop Y expression anchored
   - **Follow-face:** Y fixed to anchor edge (horizontal tracking only), prevents vertical pan from cutting source captions
3. **UI warning** — Enhance page shows: "Le clip source contient déjà des sous-titres — ton style de captions n'a pas été appliqué pour éviter le doublon." via `burnedCaptionsSkipped` flag in render status API response.
4. **Blowup Chance scoring** — Base 0.15 for "captions present" still awarded (source captions count). Style/mood-match bonuses (emphasisEffect, captionStyle, emphasisColor) NOT awarded since our captions aren't rendered.

### AI Voiceover — Original Commentary Layer

TikTok's originality policy cites "original voiceover" as an acceptable creative transformation. The pipeline generates and mixes AI commentary:

**Chain**: Word timestamps (Whisper) -> Script generation (Claude Haiku) -> TTS synthesis (ElevenLabs) -> FFmpeg audio mix with ducking.

**Prerequisites** (all must be true for voiceover to produce output):
1. `settings.voiceover.enabled !== false` (default ON)
2. `wordTimestamps.length > 0` — requires Whisper transcription to have run (inside `captionsRequested` block)
3. `duration > 5` — clips under 5s skip voiceover
4. `ANTHROPIC_API_KEY` env var set on Railway VPS — needed for script generation
5. `ELEVENLABS_API_KEY` env var set on Railway VPS — needed for TTS synthesis

If any prerequisite fails, the render job's `debug_log` shows a `VOICEOVER SKIPPED: reason=...` or `VOICEOVER SCRIPT: ABORT reason=...` line identifying the exact cause.

**Script generation** (`vps/routes/render.js` > `generateVoiceoverScriptOnVps`):
- Claude Haiku writes 2-4 short commentary lines (5-10 words each)
- 1 hook at 0.2s (anticipation), 1-2 reactions near silence gaps, optional closer
- Uses word timestamps to find silence gaps (>= 0.4s) — never places VO over key streamer dialogue
- If no silence gaps found, places hook at start and closer at end anyway

**TTS synthesis** (`vps/lib/elevenlabs-client.js`):
- ElevenLabs `eleven_multilingual_v2` model — best style expressiveness (reads punctuation, CAPS, ! as emotion)
- Voice settings: stability 0.30 (expressive), similarity_boost 0.75, style 0.55, speaker boost ON
- 3 voices: default = Brian (energetic young male), female = Jessica (upbeat), deep = Callum (punchy deep)
- Script prompt demands performable text: ! for excitement, ... for suspense, CAPS for emphasis, fragments > sentences
- Cost: ~$0.01-0.03/clip ($0.15/1K chars), logged to `ai_calls` with `feature: voiceover_elevenlabs`
- 15s timeout per line; any failure → render continues without voiceover

**Audio mixing** (`vps/lib/ffmpeg-render.js`):
- VO MP3s added as extra FFmpeg inputs, delayed to their `startTime` via `adelay`
- Ducking via `sidechaincompress`: original audio drops to ~35% during VO (threshold=0.02, ratio=4:1, attack/release=200ms)
- Final `amix` merges ducked original + voiceover track
- Audio fingerprint shift (diversified +1.8-4.2% asetrate/atempo) always applied on all renders, logged as `AUDIO SHIFT` in debug_log

**UI** (Enhance page accordion "AI Voiceover"):
- Toggle (ON by default), voice selector (3 options), editable script preview
- Script populated after AI Optimize runs or during render
- Available on ALL plans (Free, Pro, Studio)

**Failure tracking**:
- Every skip/failure logs a distinct reason in `debug_log`: `disabled_by_user`, `no_word_timestamps`, `clip_too_short`, `no_ANTHROPIC_API_KEY`, `no_ELEVENLABS_API_KEY`, `transcript_too_short`, `claude_api_error`, `no_json_array_in_response`, `json_parse_error`, `all_lines_filtered`, `exception`
- 3+ consecutive render failures → Discord alert to `#critical-alerts`
- Success resets the consecutive counter

**Graceful degradation**: render always succeeds without voiceover. No TTS failure blocks a render.

### Gotchas
- VPS POST has 15s timeout but VPS continues processing (fire-and-forget)
- Polling adaptive backoff: 0-30s = 3s interval, 30s-2min = 5s, 2min-5min = 10s, 5min+ = 30s
- Signed URLs expire after 4 hours (covers VPS queue wait + long renders)
- Realtime fallback to polling triggers after 5s if WebSocket fails to connect

---

## 5. Kick Proxy (HLS Streaming)

Edge Runtime proxy rewrites Kick HLS playlists so `.ts` segments route through the proxy, bypassing CORS.

### Files
- `app/api/clips/kick-proxy/route.ts` — **Current**: Netlify Edge Runtime (`export const runtime = 'edge'`)
- `workers/kick-proxy/worker.js` — **Prepared**: Cloudflare Worker replacement (not yet deployed)
- `workers/kick-proxy/wrangler.toml` — Wrangler config for `npx wrangler deploy`

### Flow
1. `GET /api/clips/kick-proxy?url={.m3u8 URL}` -> fetch upstream from `clips.kick.com`
2. Rewrite relative `.ts` references to point back through proxy
3. Return rewritten playlist; player requests each segment through same proxy

### Cloudflare Worker Migration (Planned)
The `workers/kick-proxy/` directory contains a ready-to-deploy Cloudflare Worker with identical logic and SSRF protections. Benefits: global edge, no cold starts, Cloudflare-native rate limiting. Migration steps documented in `workers/kick-proxy/README.md`. After migration, set `NEXT_PUBLIC_KICK_PROXY_URL` env var and delete the Netlify Edge route.

### Gotchas
- **Rate limited**: 30 req/min per IP via Upstash Redis (inline, Edge-compatible). Fail-open if Redis down. CF Worker uses Cloudflare rate limiting rules instead
- **SSRF prevention**: rejects non-HTTPS, auth in URL, explicit ports, path traversal (`..`, `%25`), non-`clips.kick.com` hosts
- **Whitelist**: only `clips.kick.com` host, only `.m3u8` and `.ts` extensions
- `.ts` segments streamed directly (`new NextResponse(upstream.body)`) — no memory buffering
- `fetchWithRetry()` (Netlify version only): 10s AbortSignal.timeout, max 1 retry, only on 5xx
- Cache: `.m3u8` = no-cache; `.ts` = `max-age=86400, immutable`

---

## 6. Creator Rank

5-factor creator scoring synced from YouTube, with rank badges and account snapshots.

### Files
- `lib/scoring/account-scorer.ts` — `scoreAccount(input): AccountScoreOutput`
- `app/api/account/sync/route.ts` — YouTube Data API calls, token refresh, scoring
- `stores/account-store.ts` — `fetchAccountScore()`, `syncAccount()`
- `components/settings/creator-rank-section.tsx` — badge, progress bars, stats

### Sync Flow (POST /api/account/sync)
1. Auth check + rate limit (1 sync per 24h via `sync_count_today`)
2. `getValidToken()` with auto-refresh (5-min buffer)
3. YouTube API: `channels.list` (subscribers) -> `search.list` (20 recent videos) -> `videos.list` (per-video stats)
4. Compute: median views, engagement rate, shorts ratio, growth % 30d
5. `scoreAccount()` -> update `social_accounts` + insert `account_snapshots` (daily or weekly)

### Hidden Gem
Evaluated BEFORE score thresholds: `performance > 80 AND audience < 55` (~< 1K followers) -> `hidden_gem` rank.

---

## 7. Upload Flow

Upload user's own clip to Supabase Storage, then redirect to enhance page.

### Files
- `app/api/upload/route.ts` — rate limit (upload: 10/min), multipart validation, storage upload, DB insert, rollback on failure
- `components/video/upload-zone.tsx` — react-dropzone UI with 5 visual states (idle, dragover, uploading, error, success)
- Dashboard page: hidden file input + "Upload clip" button with XHR progress tracking

### Flow
1. Select file via button click or drag-and-drop (`.mp4, .mov, .mkv, .avi, .webm`, max 500MB)
2. Client-side validation: file type (react-dropzone accept + maxSize), size (500MB). Rejection errors shown inline
3. Upload via XMLHttpRequest for real progress tracking (percentage in button + progress bar)
4. `POST /api/upload`: rate limit, MIME + extension validation, size check, Supabase Storage upload
5. Insert `videos` row (status=uploaded). On DB failure: cleanup uploaded file (rollback)
6. Success state shown briefly, then redirect to `/dashboard/enhance/{video.id}?source=upload`

### Upload Zone States
idle (dashed border), dragover (orange), uploading (progress bar), error (red + retry), success (green + "Redirecting...")

### Enhance Page — Upload Source
When `source=upload`, loads from `videos` table. Nullable trending fields default to null. Platform=`'upload'`, author=`'You'`. Signed URL for preview (4h TTL).

---

## 8. Distribution / Publishing

Multi-platform publishing to TikTok, YouTube, Instagram with OAuth token management.

### Files
- `app/api/publish/[platform]/route.ts` — per-platform upload
- `lib/distribution/token-manager.ts` — `getValidToken()`, mutex-locked auto-refresh
- `lib/distribution/platforms.ts` — OAuth URLs, scopes
- `lib/distribution/posting-schedule.ts` — `isGoodTimeToPost()`, `getBestPostingTime()`, `getPostingSchedule()`
- `stores/distribution-store.ts` — `publishClip()` fires parallel publishes
- `components/distribution/publish-dialog.tsx` — caption, hashtags, platform selection, **posting time advice**

### Platform Details
- **TikTok**: Direct post via `/v2/post/publish/video/init/` (pull-from-URL). Privacy chosen per-post by user in `TikTokPublishDialog`. Falls back to inbox mode if Direct Post scope rejected.
- **YouTube**: Resumable upload (download video -> start session -> upload bytes). Privacy: user-selectable in `UnifiedPublishDialog` (Public / Unlisted / Private, default Public), sent as `youtube_privacy` in publish body. **ACTIVE** since 2026-08-31. Scopes: `youtube.upload`, `youtube.readonly`. OAuth: `access_type=offline&prompt=consent` for refresh token.
- **Instagram**: Reels via Instagram API with Instagram Login v21.0 (`graph.instagram.com`). OAuth: `www.instagram.com/oauth/authorize` → `api.instagram.com/oauth/access_token` (POST, short-lived) → `graph.instagram.com/access_token?grant_type=ig_exchange_token` (60-day long-lived) → refresh via `ig_refresh_token`. Scopes: `instagram_business_basic`, `instagram_business_content_publish`. Client: `INSTAGRAM_APP_ID` (968105895801028) + `INSTAGRAM_APP_SECRET`. **No Facebook Page required** — token works directly on `graph.instagram.com`, `publishToInstagram` uses the user's IG token (not a page token). Callback validates `account_type !== 'PERSONAL'` — rejects personal accounts with clear error. No `ig_business_account_id` or `page_access_token` stored for Instagram (those are Facebook-Login-era artifacts). Publish: **async two-phase** — POST `/api/publish/instagram` creates Reel container + returns `{ status: 'processing', publicationId }` immediately (< 8s, fits Netlify). Client polls `GET /api/publish/status?publicationId=` every 5s (one IG status check per call). When container FINISHED, the status endpoint calls POST `/media_publish` and returns `{ status: 'published', postId }`. **COMING SOON** — gated by `isComingSoonPlatform`, unlockable via `META_PREVIEW_EMAILS`.
- **Facebook**: Page video via Graph API v25.0. OAuth: Facebook Login for Business → `graph.facebook.com/v25.0/dialog/oauth`. Scopes: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `business_management`. After code exchange: short-lived user token → long-lived (fb_exchange_token) → GET `/me/accounts` → Page token (never expires) stored in `social_accounts.platform_metadata` (page_id, page_name, page_access_token encrypted). Publish: POST `/{page_id}/videos` with `file_url` — synchronous, FB downloads video server-side (8s timeout). **COMING SOON** — same gating as Instagram.

### Platform Lists
- **`SUPPORTED_PLATFORMS`** (`lib/distribution/platforms.ts`): All platforms with UI presence = `['tiktok', 'youtube', 'instagram', 'facebook']`. Controls what APPEARS in the UI.
- **`LAUNCH_ACTIVE_PLATFORMS`** (`lib/distribution/launch-platforms.ts`): Platforms approved for publishing = `['tiktok', 'youtube']`. Controls what can PUBLISH. `isComingSoonPlatform(p, userEmail?)` = not in this list, UNLESS `userEmail` is in `META_PREVIEW_EMAILS` and platform is instagram/facebook.
- **`META_PREVIEW_EMAILS`** (env var): comma-separated emails that bypass the coming-soon gate for instagram/facebook. Server: authorize + publish routes pass `user.email` to `isComingSoonPlatform`. Client: `GET /api/me/platform-access` returns `{ previewPlatforms: ['instagram','facebook'] }` (no email exposed) → `usePlatformAccess()` hook provides `isComingSoon(p)` used by `unified-publish-dialog.tsx`, `connect-accounts.tsx`, `platform-connection-map.tsx`. Module-level cache — fetched once per session.
- **`Platform` type**: Single definition in `platforms.ts`, re-exported by `launch-platforms.ts`. Currently `'tiktok' | 'youtube' | 'instagram' | 'facebook'`.
- To enable a new platform: add it to `LAUNCH_ACTIVE_PLATFORMS` in `launch-platforms.ts`.

### Launch Gating (TikTok + YouTube active; Instagram + Facebook preview-gated)
TikTok and YouTube are approved for publishing. Instagram and Facebook are hard-gated unless user email is in `META_PREVIEW_EMAILS`:
- **Server**: `app/api/publish/[platform]/route.ts` calls `isComingSoonPlatform(platform, user.email)` — rejects with 403 "coming soon" unless in the allow-list. `app/api/oauth/[platform]/authorize` does the same check before redirecting to the OAuth provider.
- **Client (UnifiedPublishDialog)**: `isComingSoonPlatform()` prevents auto-select, toggle, counting, and publishing for non-active platforms. `selectedCount` excludes them. Render shows "Coming soon" badge. Post-render footer: two primary buttons side-by-side ("Place in bank" secondary amber + "Publish to N platform" primary amber gradient), "Done" + Download below. After bank click: badge "✓ Placed in bank — autofarm will schedule it", button becomes "View in bank →" (emerald, navigates to `/dashboard/distribution?scrollTo=bank&highlight={clipId}`), Publish still available. Mobile (390px): primary buttons stack full-width (Publish on top), Done/Download below. No auto-bank — clip is NOT banked until user explicitly clicks.
- **Client (DistributionHub)**: `activePlatformCount` uses `isComingSoonPlatform()` from `usePlatformAccess()` hook (not hardcoded `supported` field). Button text uses `formatPlatformList()` for dynamic copy ("Posting to TikTok & YouTube"). `connectedPlatforms` filters out `disconnected_at` accounts — disconnected platforms show "Not connected" + Connect button (not "Tap to select" with dead checkbox). `PublishTarget` type and defaults include all 4 platforms (tiktok, youtube, instagram, facebook).
- **Client copy**: All platform-count text ("Post to N platforms", "Published to TikTok") replaced with `formatPlatformList()` (`lib/distribution/format-platforms.ts`) — shows actual platform names ("Published to TikTok & YouTube — 5:23 PM").
- **Single source of truth:** `lib/distribution/launch-platforms.ts` exports `LAUNCH_ACTIVE_PLATFORMS`, `isComingSoonPlatform()`, `isActivePlatform()`. Imported by `unified-publish-dialog.tsx` (client) and `publish/[platform]/route.ts` (server). To enable a new platform: add it to this one file.

### TikTok PROCESSING Dialog Behavior
The `TikTokPublishDialog` polls `/api/tiktok/publish-status` every 5s after publishing:
- **Timeout**: max 36 polls (~3 min). After timeout, shows "Still processing on TikTok's side — your post will appear when ready. Safe to close." Close button becomes active.
- **Network errors**: 3 consecutive poll failures → same timeout behavior (stop polling, enable close).
- **Close during PROCESSING**: Always allowed once the initial publish request completes (publishId exists). Closing does not cancel the TikTok-side post — user is informed. Button text: "Close (post continues on TikTok)".

### Published Posts Learning Loop
Every publish inserts a `published_posts` row with render settings snapshot for pattern detection. Three metadata sources, cascading:
1. **Client metadata** — `UnifiedPublishDialog` sends `metadata` (caption_style, hook_style, hook_enabled, split_screen_enabled, smart_zoom_mode, clip_mood, duration_seconds, blowup_chance_at_render) from the enhance page state
2. **Server auto-resolve** — `render_jobs.render_settings` JSONB column (persisted at render time) fills any gaps the client didn't send
3. **Trending clip data** — `trending_clips` provides source_platform, source_streamer, niche, algo_score_at_pick, duration_seconds

All three publish paths insert into `published_posts`: manual (via `POST /api/publish/[platform]`), autofarm (via `execute-publish.ts`), and distribution hub TikTok dialog.

Stats cron (`refresh-post-stats`) tracks `last_checked_at` + `check_count` on every attempt (success or failure) to distinguish "never tried" from "tried and failed". Per-platform summary logged each run.

### Token Manager
`getValidToken(userId, platform)`: checks expiry with 5-min buffer -> auto-refresh if expired. Uses Upstash Redis distributed lock (`SET lock:token:{platform}:{userId} 1 NX EX 30`) to prevent concurrent refreshes across serverless isolates. If lock is held, waits 2s then re-reads the freshly refreshed token from DB. Lock released in `finally` block.

### Posting Time Advice
`lib/distribution/posting-schedule.ts` provides per-platform optimal posting hours (UTC). Integrated into the publish dialog: shows a green/amber/red badge per enabled platform with a suggestion like "Best time to post right now!" or "Low engagement now. Best in 3h". Data is static (based on public research), not personalized.

### Autofarm Executor (v10)
Queue-based auto-posting pipeline: user enables Auto-Distribute toggle → client POST `/api/distribution/autofarm-sync` → insert rows in `scheduled_publications` (source='autofarm', tiktok_options from user-configured `auto_post_defaults`, caption from `generateVariants()` template engine) → cron `publish-scheduled` (every 5-10min) picks up rows WHERE `status='scheduled' AND scheduled_at <= now()` → optimistic lock → guard against already-published clips → publish via platform API → insert `published_posts` → set `removed_from_bank_at` on render_job (prevent republish loop) → cleanup.

**Key safety mechanisms (v10)**:
- `auto_post_defaults` REQUIRED before toggle ON (TikTok compliance — user chooses privacy/interactions)
- Captions never empty: template engine generates from clip title + niche hashtags
- Sync route inserts FIRST, cancels old rows AFTER (if insert fails, existing queue survives)
- Clips already in `published_posts` are excluded from sync (no republish)
- **Published = consumed (single rule)**: both autofarm cron AND manual publish (UnifiedPublishDialog) call `PATCH /api/distribution/bank/{clipId}` with `action: 'remove'` on successful publish. Sets `removed_from_bank_at` on render_job + cancels pending `scheduled_publications`. TikTok direct: removed in `handleTikTokConfigured`. TikTok inbox (drafts): stays in bank (not confirmed published). Non-TikTok: removed after `Promise.allSettled` if any succeeded. Failed publish = clip stays in bank. The bank is a publish queue, not an archive
- Toggle OFF settings persist to DB; failure reverts toggle with error message
- TikTok dialog publishes feed the same stats path as publishProgress (publishHistory, persistentStats, rewards)

**Metrics policy**: Post-publish grid shows "PROJECTION · Example only" label on all simulated metrics. Real stats from `publication_performance` table shown when available via `cron-refresh-post-stats`. No fake numbers presented as real.

**Bank route**: `POST /api/distribution/bank` (restore clip to bank), `PATCH /api/distribution/bank/[clipId]` (remove/restore).

Toggle OFF cancels all pending autofarm rows. Launch: TikTok + YouTube. Details : `SYSTEM-REFERENCE-DISTRIBUTION.md`.

### Gotchas
- TikTok `publish_id` returns immediately but posting is async
- Google doesn't rotate refresh tokens; TikTok does
- Redis down: lock acquisition falls through (best-effort), refresh proceeds without coordination
- All tokens encrypted AES-256-GCM via `lib/crypto.ts`

---

## 8b. Candidate Check (Pre-Render Analysis)

Detects bad render candidates BEFORE the user clicks Generate. Advisory only — never blocks a render.

### VPS Endpoint
`POST /api/analyze-candidate` (auth: x-api-key, same as /render)
- Input: `{ videoUrl, fallbackUrl, clipId }`
- Downloads via yt-dlp wrapper (reuses existing cache)
- **Dark check**: `ffmpeg -vf "fps=1,signalstats"` → per-second luma average. Flag `too_dark` if darkSecondsRatio > 0.3 OR longestDarkStretch > 6s. Threshold: luma < 20.
- **Speech check**: `ffmpeg -af "silencedetect=noise=-35dB:d=0.5"` → speechRatio (non-silence %). Flag `low_speech` if speechRatio < 0.25 OR longestSilence > 8s. NOTE: proxy only — music counts as speech. Acceptable for warnings.
- Global timeout: 30s. On failure returns `{ flags: [], error }`.
- Output: `{ darkSecondsRatio, longestDarkStretch, speechRatio, longestSilence, flags, analyzedAt }`

### DB Columns (trending_clips)
```sql
candidate_flags TEXT[]          -- ['too_dark', 'low_speech']
candidate_metrics JSONB         -- { darkSecondsRatio, speechRatio, whisperWordCount, ... }
candidate_checked_at TIMESTAMPTZ
```
Migration: `20260831_candidate_check.sql`

### Next.js Proxy
`POST /api/clips/candidate-check` (auth: user session)
- Validates input (zod schema: `lib/schemas/candidate-check.ts`)
- Checks `candidate_checked_at` in DB — returns cached result if exists (never re-analyze)
- Calls VPS `/api/analyze-candidate`, stores result in `trending_clips`

### UI (Enhance Page)
- Fires check on page load (non-blocking, after clip data loads)
- Warning banner above Generate button if flags present:
  - `low_speech` → "Low dialogue detected — AI hook and captions will be weak on this clip."
  - `too_dark` → "Long dark sections detected — this clip may lose viewers."
  - Both → "This clip is a poor candidate: low dialogue + dark sections. Pick another clip for better results."

### Scoring Impact
- `low_speech`: hook weight capped at 0.04 (vs normal 0.14), caption mood-match bonuses reduced
- `too_dark`: 15% flat penalty on total boost (× 0.85)
- Both flags propagated to `computeCurrentScore()` and `computeScoreBreakdown()`

### Truth Loop
On render completion, VPS sends `wordCount` (Whisper word count) in the webhook payload. The render hook route stores it in `candidate_metrics.whisperWordCount` on the trending_clips row. This enables future calibration of the silencedetect proxy threshold against real Whisper data.

### Files
- `vps/routes/analyze-candidate.js` — VPS endpoint
- `app/api/clips/candidate-check/route.ts` — Next.js proxy
- `lib/schemas/candidate-check.ts` — Zod schema
- `lib/enhance/scoring.ts` — candidateFlags parameter in scoring functions
- `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` — UI banner + check trigger

---

## 9. Cron Jobs

Next.js API routes authenticated via `x-api-key: CRON_SECRET`. **SCHEDULING EXTERNE A VERIFIER** — `netlify.toml` contient uniquement des commentaires (pas de `[functions."cron-*"]`), plusieurs crons n'ont potentiellement jamais tourne (0 rows en DB). Scheduler externe recommande (cron-job.org, GitHub Actions, etc.).

### Schedule
| Function | Cron | Route | Purpose |
|----------|------|-------|---------|
| `cron-fetch-clips` | `0 */3 * * *` | `POST /api/cron/fetch-twitch-clips` | Fetch new Twitch + Kick clips |
| `cron-rescore` | `*/15 * * * *` | `POST /api/cron/rescore-clips` | Stratified rescoring (batch 200) |
| `cron-cleanup-render-jobs` | `*/5 * * * *` | `POST /api/cron/cleanup-render-jobs` | Zombie jobs >10min -> error + refund quota |
| `cron-cleanup-storage` | `0 4 * * *` | `POST /api/cron/cleanup-storage` | Delete expired clips (free=7d, pro=30d, studio=90d) |
| `cron-reset-usage` | `0 0 1 * *` | `POST /api/cron/reset-usage` | Reset `monthly_videos_used` to 0 |
| `cron-reconcile-render` | `*/30 * * * *` | `POST /api/cron/reconcile-render` | Reconcile Redis active jobs Set with DB — remove stale entries, dispatch queued |
| `cron-publish-scheduled` | `*/5-10 * * * *` | `POST /api/cron/publish-scheduled` | Autofarm executor — publish due scheduled_publications |
| `cron-refresh-post-stats` | `0 */6 * * *` | `POST /api/cron/refresh-post-stats` | Batch refresh metrics from platform APIs |
| `cron-ai-triage` | `*/15 * * * *` | `POST /api/cron/ai-triage` | Claude Haiku classification of inbox emails |
| `cron-ai-scoring` | `0 * * * *` | `POST /api/cron/ai-scoring` | Claude Haiku scoring of top leads |
| `cron-watchdog` | `*/30 * * * *` | `POST /api/cron/watchdog` | Anomaly detection on key metrics |
| `cron-sync-instantly` | `*/15 * * * *` | `POST /api/cron/sync-instantly` | Sync Instantly mailboxes + campaigns |
| `cron-monthly-payouts` | `0 0 1 * *` | `POST /api/cron/monthly-payouts` | Calculate affiliate payouts |

### Rescore Details
- Stratification: `<6h` every 15min, `6-24h` every 1h, `>24h` every 24h
- Spike: +20% views vs last snapshot -> priority rescore in 5min
- Batched IO: 1 SELECT clips + 1 SELECT streamers + 1 SELECT snapshots (all clips) + 1 INSERT batch snapshots + 1 RPC `bulk_update_scores` (migration `20260425_bulk_rescore.sql`)
- `anomaly_score` DB column stores `authority_score` (naming mismatch, backward compat)

### Cleanup Storage
Sets `status='expired'` and `storage_path=NULL` (preserves row for audit). Deletes from `clips` + `thumbnails` buckets. Max 50 files per run. TTL per plan: free=7d, pro=30d, studio=90d. Frontend remix cards detect `status === 'expired'` and show an "Expired" badge with upgrade hint and a "Remix Again" button. Migration: `20260425_expired_status.sql` (adds `expired` to status CHECK constraint + backfills).

---

## 10. Analytics

Privacy-first, batched event tracking with DNT respect and fire-and-forget delivery.

### Files
- `lib/analytics.ts` — `track(name, metadata?)`, batching, `sendBeacon` flush
- `app/api/events/route.ts` — Zod validation, rate limit (120/session/5min), Supabase insert

### Design
- Session ID: random UUID per tab (`sessionStorage` key `vsp:analytics_session`)
- Batched: queued, flushed every 2500ms or on `pagehide`/`visibilitychange`
- Uses `navigator.sendBeacon()` on unload. Respects `navigator.doNotTrack`
- UTM params auto-parsed from URL. Failures never surface to user

### Product Funnel Events
`clip_clicked`, `clip_saved`, `enhance_started`, `enhance_option_changed`, `render_launched`, `render_completed`, `render_failed`, `clip_downloaded`, `clip_shared`

### Landing Page V2 (2026-07-19)

6-section flow: Hero → Radar → Farm → Pricing → FAQ → Final CTA.
Mobile-first. No fake numbers, no testimonials.

| Section | Component | Notes |
|---|---|---|
| Hero | `hero-section.tsx` | 3-clicks pipeline demo (7.2s CSS cycle: Pick→Enhance→Post). Static score narrative: Zone 1 card = 87, Zone 2 bar = 87→96. Thumbnail: `/landing/radar-thumb-1.jpg` (local, no API). Micro-features line below. Bridge card REMOVED. No bridge API fetch. Padding-bottom 80px. |
| Radar | `how-it-works-section.tsx` | **LIVE** — fetches `/api/landing/radar` (ISR 15min). Royal card = top pick (live), 1st rising = live, **2nd rising (slot 3) = STATIC "67 meme" card** (Agent00 "Professor Agent teaches clip farming", score 67 rainbow — founder's meme, never wired to API), partial = live. All scores Math.round (no decimals). Total clips = real DB count rounded to 100. Static fallback if API fails |
| Farm | `features-grid.tsx` | Step 2 — Automation. Brain pipeline (8s cycle). Platform apps: TikTok live + YouTube/Instagram/Facebook with SOON badges. Countdown EXAMPLE panel (live JS). Thumbnails: `/landing/farm-thumb-1/2.jpg` |
| Pricing | `pricing-section.tsx` | Free $0 / Pro $19 / Studio $24 founding (via `isStudioLaunchActive()`, expires `STUDIO_LAUNCH_ENDS_AT` 2026-09-30) or $29 after |
| FAQ | `faq-section.tsx` | "Questions clippers actually ask" — 5 items single-open accordion (native `<details name="faq">`), bg #0B0F1E, sober slate. Copy: rights, recording, TikTok official, quota, cancel |
| Final CTA | `final-cta-section.tsx` | Bg #020617 + faint radar echo (2 cyan rings), wolf Or Forge 200px + amber glow, "The radar already found your next clip.", CTA "Claim your first clip", trust line |

Testimonials section retired (returns null). Exit-intent popup unchanged.

### Landing Events
`landing_cta_clicked` (placement: hero/hero_watch/radar/pricing/final), `exit_intent_shown/submitted/dismissed`, `newsletter_submitted`

---

## 11. Auth & Onboarding

Supabase Auth with email/password + Google OAuth, protected routes, welcome modal and referral system.

### Files
- `app/(auth)/login/page.tsx` — `signInWithPassword()`, redirect to `/dashboard`
- `app/(auth)/signup/page.tsx` — referral code capture (URL param -> cookie -> localStorage)
- `app/auth/callback/route.ts` — server-side PKCE code exchange (password recovery, email confirm, magic links). Reads `?code=` + `?next=`, exchanges via `supabase.auth.exchangeCodeForSession()`, redirects to `next` (default `/dashboard`). Errors redirect to `/login?error=`.
- `app/auth/reset/page.tsx` — password reset form. Session set by `/auth/callback` (server-side) or client-side code exchange fallback. Listens for `PASSWORD_RECOVERY` event + checks existing session. Shows new password form → `updateUser({ password })` → redirects to `/dashboard`.
- `middleware.ts` — protects `/dashboard`, `/settings`; redirects authed users from `/login`
- `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR)
- `components/onboarding/welcome-modal.tsx` — 3-step onboarding (localStorage `vsp.onboarding.welcome.v1`)
- `components/onboarding/first-clip-overlay.tsx` — curated clip grid, 1-click quick export. Error states: quota (402) → upgrade CTA, rate limit (429) → retry message, default → generic retry. Network errors caught separately.
- `components/onboarding/referral-bonus-banner.tsx` — shows when `bonusVideos > 0`

### Referral Flow
Signup checks 3 sources: URL `?ref=CODE`, cookie `ref` (from `/ref/[handle]`), localStorage `vsp:referral_code`. Stored in `options.data.referred_by_code`.

---

## 12. Social Proof & FOMO

Real-time export ticker, velocity badges, trending timers and notification bell for viral clips.

### Files
- `components/trending/export-ticker.tsx` — Supabase Realtime Broadcast (channel `export-feed`, event `new_export`)
- `components/trending/notification-bell.tsx` — portal popup, max 5 notifications
- `components/trending/velocity-badge.tsx` — tier styling (Viral/Hot/Rising/Slow)

### Export Count
`TrendingClip.export_count` on cards: "Fresh -- be the first" if 0, "Used by X creators" otherwise. Incremented via RPC `increment_export_count` when render job reaches `done` status (in `/api/render/status`), with idempotency guard via Redis key `export_counted:{jobId}` (NX, 24h TTL) — prevents double-counting on repeated polls.

### Live Ticker
Supabase Broadcast (no DB persistence). Anonymous payload `{ score, rank, platform }`. Emitted from `/api/render/status` after `increment_export_count` RPC succeeds (same idempotency guard as the count). Auto-hides after 8s. Fire-and-forget — never blocks render flow.

### Notification Bell
Triggers when `fetchClips()` detects new clips with `velocity_score >= 80`. Pulsing unread badge. Panel shows title, platform, score, time-ago.

### Pro Gate
Master (>=95) and Legendary (>=80) clips visible but locked for free users: blur overlay + "Unlock with Pro" CTA -> `/pricing`. Pro/Studio users see everything. Plan fetched once from `profiles.plan`.

---

## 13. Before/After Player

Split-view comparison player with draggable slider and synced video playback.

### Files
- `components/video/before-after-player.tsx` — drag logic, clip-path split, video sync
- Integration in `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` — "Compare" button

### Implementation
- Two `<video>` elements with `clip-path: inset(...)` at slider position (5%-95% range)
- Drag: mouse + touch via document-level event listeners
- Sync: `timeupdate` on "after" video syncs "before" if drift > 0.3s
- "Compare" button appears only when `isRenderedVideo && originalVideoUrl && renderDownloadUrl`

---

## 14. Rate Limiting

Distributed rate limiter using Upstash Redis sliding window counter.

### Files
- `lib/rate-limit.ts` — `rateLimit()` (async, Upstash Redis)
- `lib/upstash.ts` — `redis` singleton (`Redis.fromEnv()`)

### Presets
| Tier | Limit | Window | Applied On |
|------|-------|--------|------------|
| `ai` | 5 | 60s | `/api/render`, `/api/render/quick`, `/api/enhance/ai-optimize` |
| `standard` | 30 | 60s | General API calls |
| `upload` | 10 | 60s | `/api/upload` |
| `webhook` | 100 | 60s | `/api/stripe/webhook` |
| `browse` | 60 | 60s | `/api/trending`, `/api/events` |
| `videoUrl` | 30 | 60s | `/api/clips/video-url` |
| `status` | 120 | 60s | `/api/render/status` |
| `data` | 30 | 60s | `/api/clips/sparkline`, `/api/clips/my-remixes` |

### Design
Redis key = `rl:{identifier}`, value = counter, TTL = window in seconds. Each request does `INCR` + `EXPIRE` (on first hit). Works across all serverless isolates.

**Failure modes:**
- **Fail-open** (default): if Redis is unreachable, allow the request. Used for non-critical endpoints.
- **Fail-closed** (`{ failClosed: true }`): if Redis is unreachable, DENY with 503. Use for expensive operations (render, upload).

### Security
- **RLS**: Row Level Security enabled on all user tables (`render_jobs`, `videos`, `clips`, `social_accounts`, `account_snapshots`, `profiles`, `saved_clips`). Public read on `trending_clips` and `streamers`. Service role bypasses RLS. Migration: `20260425_rls_policies.sql`
- **HMAC webhook**: `/api/render/hook` accepts VPS callbacks with `HMAC-SHA256(body, VPS_RENDER_API_KEY)` in `X-Webhook-Signature` header + timestamp anti-replay (5min window). Falls back to `X-Api-Key` header for backward compatibility.

---

## 15. Retry Strategy

Exponential backoff wrapper with HTTP status awareness.

### Files
- `lib/utils/with-retry.ts` — `withRetry()`, `fetchOrThrow()`, `HttpError`

### Rules
- Default: 2 retries (3 total), 1000ms base delay, backoff `delay * 2^attempt`
- **Retry**: 5xx, network errors, connection errors
- **Never retry**: 4xx, `AbortError`, `TimeoutError`

### Per-Service Config
| Service | Retries | Delay | Fallback |
|---------|---------|-------|----------|
| Claude API (mood) | 2 | 1s | "hype" mood |
| VPS Render | 1 | 2s | Respects 15s AbortController |
| Twitch Helix | 2 | 1s | Keeps existing 401 token retry |
| Kick API | 2 | 1s | Returns `[]` on 4xx |

---

## 16. PWA (Progressive Web App)

Installable web app. **Service worker REMOVED** (2026-08-10) — the old SW caused false "You're offline" pages after deploys (stale cache + overly broad fetch catch). The app is online-only by nature.

### Files
- `app/manifest.ts` — Next.js route-based manifest (standalone, portrait, dark theme #020617)
- `public/sw.js` — **KILL SWITCH** (not a real SW). On activate: deletes all caches, unregisters itself, reloads all tabs. Exists so browsers with the old SW fetch this version and self-destruct.
- `public/offline.html` — kept but never served (no SW to intercept navigations)
- `public/icons/` — wolf gold forge icons (192, 512, maskable-512 PNGs)
- `hooks/use-pwa-install.ts` — listens to `beforeinstallprompt`, exposes `canInstall` + `promptInstall()`
- `components/pwa/install-banner.tsx` — mobile-only install prompt, dismiss stored in localStorage for 7 days
- `app/layout.tsx` — PWA meta tags + `register('/sw.js')` kept temporarily so existing users fetch the kill switch. Remove the Script tag once all users have cycled through (~30 days after deploy).

### Service Worker Strategy
- **NONE** — no fetch interception, no caching, no offline fallback. The kill-switch SW at `/sw.js` has zero fetch handlers.

### Install Banner
- Only shows on mobile (hidden via `md:hidden`)
- Only shows when browser supports install (`beforeinstallprompt` event)
- Dismiss persisted in localStorage `vsp:pwa-dismiss` for 7 days
- Rendered at the bottom of the dashboard page

## 17. Capture Mode (Promo Recordings)

Activated via `?capture=1` on any dashboard URL. Persists in `sessionStorage` (`va:capture-mode`) so it survives page navigation within the session. Ends on new tab/window or session close.

**Implementation:** Dashboard layout (`app/(dashboard)/layout.tsx`) detects the param, adds `.capture-mode` class to root. Elements tagged with `data-capture-hide` are hidden via `globals.css`: `.capture-mode [data-capture-hide] { display: none !important; }`.

**Hidden elements:**
- Browse: Upload clip + Refresh buttons (header right slot)
- Browse: "More filters" toggle button
- Browse: Refresh indicator (bottom floating pill)
- Browse: PWA install banner, FirstClipOverlay, ReferralBonusBanner
- Sidebar: "Clips this month" usage counter + progress bar + upgrade CTA
- Sidebar: PACK badge (comp accounts)

**Kept visible:** Feed tabs, search bar, Score/Date sort, clip cards, Top Pick, Daily Radar — everything that IS the product.

---

## 17. Affiliate System

Self-service affiliate program for users. Separate from admin-managed `affiliates` table (influencer partners).

### Tables
- `affiliate_codes` — one per user (`user_id UNIQUE`). Fields: `code` (auto-generated, unique), `custom_handle` (optional, unique), `clicks`, `signups`, `conversions`, `total_earned`, `commission_rate` (default 0.20), `active`. RLS: users see/update own row only.
- `referral_events` — tracks clicks, signups, conversions, payouts per affiliate code. Fields: `event_type` (`click|signup|conversion|payout`), `referred_user_id`, `amount`, `metadata` (JSONB). RLS: users see events for own affiliate code.
- Migration: `20260425_affiliate_dashboard.sql`

### Files
- `app/api/affiliate/route.ts` — `GET` (fetch or auto-create affiliate code + stats), `PATCH` (update custom_handle with validation + blocklist)
- `app/api/affiliate/events/route.ts` — `GET` (paginated referral events, filterable by event_type)
- `app/ref/[handle]/page.tsx` — public server component landing page, resolves handle from `affiliate_codes` (custom_handle first, then code)
- `app/ref/[handle]/cookie-setter.tsx` — client component, sets `ref` cookie (30 days) + localStorage backup
- `components/settings/affiliate-section.tsx` — settings UI: referral link (copy), stats grid, custom handle editor, recent events

### Referral Landing Page (`/ref/{handle}`)
1. Server component resolves handle from `affiliate_codes` table (`custom_handle` then `code`)
2. If not found: `notFound()` (404)
3. Tracks click with IP-based idempotency: `SET ref_click:{affiliateId}:{ipHash} 1 NX EX 86400` (Redis). Only increments `clicks` and inserts `referral_events` if key was newly set
4. Renders hero with handle, value prop, CTA -> `/signup?ref={code}`
5. `RefCookieSetter` client component sets `ref` cookie for signup flow pickup

### Handle Validation
- 3-30 chars, lowercase alphanumeric + hyphens, must start/end with alphanumeric
- Checked against `affiliate_codes` uniqueness AND `affiliates` table (admin handles)
- Blocklist: common reserved words + offensive terms

### Settings Integration
Replaces the old simple "Referrals" section in `/settings`. Shows: copiable link, stats (clicks/signups/conversions/earned), custom handle editor, recent 5 events. Auto-creates affiliate code on first visit (GET auto-provision).

### Code Generation
Derived from user's `full_name` or email prefix (sanitized to alphanumeric). If taken, appends random 4-digit suffix. Last resort: `ref-{uuid8}`.

### Admin Influencer Affiliate Pipeline (commission lifecycle)
- **Referral status:** `attributed` (signup) → `paying` (first invoice.payment_succeeded) → `churned`/`refunded`/`disputed`. DB constraint enforces this vocabulary.
- **Commission base:** 30% on `invoice.subtotal_excluding_tax` (HT, before Stripe fees). Falls back to `amount_paid` if tax field is null.
- **stripe_charge_id:** populated from `invoice.charge` at commission creation — required for dispute matching.
- **Dispute handling:** `handleDisputeCreated` matches by `stripe_charge_id`, falls back to `stripe_invoice_id`. Creates `chargeback_clawback` ledger entry + `fraud_flags` row (severity: `critical` — blocks payouts).
- **Refund delta:** `handleChargeRefunded` computes the delta between total refunded commission and already-clawed-back amount — prevents double clawback on partial refunds.
- **Payout idempotency:** UNIQUE partial index `(influencer_id, period_start_at) WHERE status != 'canceled'` in DB. Code checks `.eq('period_start_at')` + handles 23505 gracefully.
- **Anti self-referral:** `/api/affiliate/attribute` rejects if user's email matches influencer's email. Body-only codes (no cookie) require a recent `affiliate_clicks` row within 60 days.
- **Click dedup:** `/r/[code]` rate-limited 10/IP/24h via `rateLimit()`. Same `ip_hash + code` within 24h = no duplicate row. `total_clicks` derived from `affiliate_clicks` table (no counter column).
- **Admin webhook secret:** `app/api/admin/webhooks/stripe/route.ts` uses `STRIPE_ADMIN_WEBHOOK_SECRET` (not `STRIPE_WEBHOOK_SECRET`). Each Stripe webhook destination has its own signing secret. If the env var is missing, the route returns 503 with a console warning instead of silently verifying against the wrong secret.
- **Files:** `lib/admin/webhooks/stripe-processor.ts` (commission + clawback + dispute), `lib/admin/stripe/payouts.ts` (monthly payouts + fraud checks), `lib/admin/affiliate-attribution.ts` (signup attribution), `app/api/affiliate/attribute/route.ts`, `app/r/[code]/route.ts`

### Email Compliance (CAN-SPAM / GDPR)
- **Unsubscribe flow:** `POST /api/unsubscribe` verifies token → adds email to `suppression_list` (NO `email_domain` — domain-level suppression is admin-only) → blocks influencer → removes lead from ALL active Instantly campaigns via `removeLeadFromAllCampaigns()`. Failures logged to `compliance_audit_log` for admin visibility.
- **Domain suppression policy:** `email_domain` in `suppression_list` is ONLY set by admin domain-block actions, NEVER by individual unsubscribes. Prevents blocking all @gmail.com leads when one person opts out.
- **Push-time compliance recheck:** `instantly-pusher.ts` re-runs `filterSuppressed4Way()` at push time (not just at offer generation). Leads suppressed since generation are marked `status: 'suppressed'`. CSV export also uses 4-way check.
- **GDPR delete:** `POST /api/admin/compliance/gdpr-delete` purges ALL influencer-related tables (email_messages, email_events, campaign_recipients, generated_offers, video_influencer_matches, lead_discovery_results, public_contact_points, affiliate_clicks, affiliate_referrals, commission_ledger, payouts, partner_sessions, repost_kit_sessions, fraud_flags, video_assignment_log, influencers). Suppression entry includes email + platform_handle + profile_url (4-way block).

### Partner Portal Security
- **Magic link:** 2-step flow. `generateMagicLinkToken()` creates a `session_type: 'magic_link'` row valid 15 minutes. On verification, the magic link row is deleted (single-use, atomic via DELETE+SELECT) and a new `session_type: 'session'` row is created (30-day cookie). Column: `partner_sessions.session_type CHECK ('magic_link','session')`.
- **Rate limit:** `POST /api/partner/auth/request` limited to 3/hour per email + 3/hour per IP.
- **Repost submit:** `POST /api/partner/repost/submit` NO LONGER auto-promotes to 'onboarded'. Sets `last_active_at` only + sends Discord notification for manual admin review. Onboarding is admin-only (CRM button).
- **PostgREST injection:** `/partner/repost/[handle]` validates handle with `^[a-zA-Z0-9_.\-]{1,50}$` before any DB query. Uses separate `.eq()` / `.ilike()` calls instead of `.or()` with interpolation. Same sanitization applied to admin search routes.

### Funnel Tracking & Auth
- **Events whitelist:** `app/api/events/route.ts` accepts `landing_cta_clicked`, `page_view`, `signup_started`, `signup_completed` + all existing events. Unknown events are filtered (warn-logged) instead of rejecting the whole batch.
- **Signup tracking:** `signup_started` fired at form submit, `signup_completed` after successful signUp.
- **Login redirect:** reads `?redirectTo=` from searchParams, validates it starts with `/` (prevents open redirect). Shows `?error=` from URL params (e.g. expired reset links). Forgot password flow: `ForgotPassword` component uses `<div>` (not `<form>`, since it's rendered inside the login `<form>`) + `type="button"` with `onClick` + Enter key handler. Calls `resetPasswordForEmail(email, { redirectTo: /auth/callback?next=/auth/reset })` → email link → `/auth/callback` exchanges PKCE code server-side → redirects to `/auth/reset` with session set → `updateUser({password})`.
- **Password reset page:** `app/auth/reset/page.tsx` — checks session (set by `/auth/callback`) or exchanges `?code=` client-side as fallback. Shows new password form on valid session, error + "Back to login" link on invalid/expired. Redirects to `/dashboard` after success.
- **Auth callback route:** `app/auth/callback/route.ts` — server-side PKCE exchange. Required because `@supabase/ssr` uses PKCE flow and the code_verifier cookie must be exchanged server-side for cross-device reliability.

### Security Hardening
- **Upload IDOR:** `DELETE /api/upload/sign` requires auth + `eq('user_id', userId)`. No anonymous deletion.
- **Webhook fail-closed:** `app/api/render/hook` — invalid/missing HMAC signature = 401, always. Timestamp mandatory. No warn-only mode. **NOTE FOR SAMY:** verify `WEBHOOK_SECRET` is identical on Netlify AND Railway.
- **Client IP:** `lib/api/client-ip.ts` reads `x-nf-client-connection-ip` (Netlify, unspoofable) with fallback to LAST element of `x-forwarded-for`. Never trust the first element.
- **Admin guard:** `app/(dashboard)/admin/layout.tsx` — server component checks session + `admin_users` table. Non-admins redirected to `/`.
- **Cron timing-safety:** `publish-scheduled`, `ai-triage`, `audits/trigger` all use `timingSafeCompare` instead of `===`.
- **Instantly webhook:** missing `INSTANTLY_WEBHOOK_SECRET` = reject (was fail-open). **NOTE FOR SAMY:** set `INSTANTLY_WEBHOOK_SECRET` in Netlify env.
- **CSP:** `*.ingest.sentry.io` added to `connect-src` (Sentry was loaded but blocked).
- **Referral claims:** aligned to reality across paywall, settings, pricing: "+3 clips each when your friend renders their first clip (up to 5/month)".
- **Plan residuals:** `voiceOver: false`, `apiAccess: false` in Studio plan limits (features not shipped).

### Branded Error Pages (Glitch Theme)
Shared component: `components/ui/glitch-error-screen.tsx` — cyan/amber RGB-split glitch effect with framer-motion. `useReducedMotion` → falls back to static layout (no animation). Used by:
- `app/not-found.tsx` — 404 "This page got clipped." with Go Home / Go Back buttons.
- `app/error.tsx` — runtime error "The stream dropped." with Retry / Go Home buttons, `reset()` wired to Retry.

### UI Feedback — Sonner Toasts
Library: `sonner`. `<Toaster />` mounted in `app/layout.tsx` — `theme="dark"`, `position="bottom-right"`, slate-900 background, subtle white border, amber success icon (not green).

Where toasts are wired:
- **Favorites (Browse):** `stores/trending-store.ts` `toggleSaveClip` — `toast.success('Clip saved to favorites')` on save, `toast('Removed from favorites')` (neutral) on unsave, `toast.error(...)` on failure (both `!res.ok` and `catch`). Optimistic rollback preserved.
- **Quick Export (Browse):** `app/(dashboard)/dashboard/page.tsx` `handleQuickExport` — `toast.error(...)` on fetch failure, 402 (plan limit), 429 (rate limit), and network error. Does NOT replace existing visual states (rendering spinner, done CheckCircle2, notification bar).
- **Clip Bank remove (Distribution):** `components/distribution/distribution-hub.tsx` `onRemove` — `toast('Removed from bank')` on success, `toast.error('Failed to remove clip — restored to bank')` on failure (with optimistic rollback).
- **Profile save (Settings):** `app/(dashboard)/settings/page.tsx` `handleSaveProfile` — `toast.success('Profile saved')` only on actual success, `toast.error(...)` with server message on DB error or network failure. Fixes prior bug where "Saved" showed even on error.

### Hero v2 — Permanent Raw-to-Ready
Component: `components/landing/hero-product-mockup.tsx` (`HeroProductMockup`). Always shows the final "ready" state — no phased transformation cycle.

**Frame source:** `public/landing/radar-thumb-4.jpg` (IRL streamer, bright/contrasty). Same image in both the RAW vignette (16:9 letterbox) and the phone (vertical crop, `object-fit: cover; object-position: center`).

**Visual elements (all permanently visible):**
- RAW vignette: 110px 16:9 card, "RAW CLIP" label, red "16:9" badge, grey border, -4° tilt, soft float (5s translateY ±5px)
- Connector: curved dashed SVG arrow (amber, dashoffset animation, opacity 0.75)
- Phone: 220px wide, thin chrome (1.5px border, 26px radius, 7px padding). Contains: cropped vertical image, purple hook capsule top-center, "96" score badge top-right, looping karaoke captions bottom-center ("THIS IS ACTUALLY INSANE", word-pop amber highlight cycling 2.4s per word with 0.6s stagger), "@streamer · credit added" bottom-left, "⚡ TIKTOK READY" amber text below screen
- Ambient glow: two radial-gradients behind phone — cyan (~10% opacity top) + amber (~13% bottom). Deep shadow `0 24px 60px rgba(0,0,0,.55)`

**Copy (left column):** Badge "● LIVE RADAR · TWITCH + KICK", H1 unchanged, sub "Find rising Twitch and Kick clips, turn them into TikToks with AI, and post them in one click.", features line "Captions · Vertical crop · Hook · Credit" (grey), CTA "Start Farming Free" + "See how it works ↓" (cyan dotted underline link), trust "Free to start · No credit card · Direct TikTok posting" (plain grey).

Layout: `.lv3-hero-split` — desktop: copy left + mockup right (flex row). Mobile (<900px): stacked, copy first, phone (~190px) below. Reduced motion: all static (no float, no dash animation, karaoke words white).
**Designed to be replaced by `<video>` at same dimensions** — isolate swap to `HeroProductMockup` only.
CSS: `landing-v3.css` under `HERO PRODUCT MOCKUP v2` section.

### Mobile Dashboard (390px)
**Sidebar drawer:** `stores/ui-store.ts` initial `sidebarOpen: false`. Desktop auto-opens on mount (`window.innerWidth >= 768`). Closes on route change (mobile), Escape key, scrim click. Body scroll locked while open. `role="dialog" aria-modal` on the `<aside>`.

**Clip cards (mobile vs desktop):** Same component (`trending-card.tsx`), layout split via `md:` breakpoints.
- **Desktop:** information-rich — large inline score (40-64px), platform badge, verdict + reason, score delta, "Why this clip?" hover-reveal, signal tags, bookmark hover-reveal in CTA row.
- **Mobile (decision-rich):** thumbnail full-width rounded, score badge overlay (top-right, `score-badge` in `rank-cards.css` — `md:hidden` via CSS), bookmark overlay (top-left, 44px bg-black/50), 3 lines below: title (14px semibold, tappable → enhance), metadata (@handle · views · age, 12px), verdict (12px, 1 line). Single CTA row: Enhance + Quick Export. "Why this clip?" hidden (accessible via preview overlay). NEW/LEGENDARY DROP badge repositioned (`top-9 md:top-2`) below score badge on mobile.
- **Score badge tiers:** Legendary (80+): golden capsule (`score-badge--legendary`, gradient bg, "LEGENDARY" label). Epic: dark capsule, cyan number (`score-badge--epic`). Default: dark capsule, white number.
- **Legendary frame:** Desktop 85+ gets ornate gold frame + gems. Mobile: CSS flattens frame to transparent (padding:0, bg:transparent), gems hidden, gold border only (`@media max-width:767px` in `rank-cards.css`). Top Pick keeps full frame on all sizes.
- **Top Pick freshness narration:** When the Top Pick's score is lower than the highest in the grid (`hasHigherOlderClip`), the card makes the freshness logic visually obvious: (1) above the title, a cyan micro-badge replaces the amber "Top Pick" pill: "EARLY — catch it before it peaks"; (2) next to the score, a green animated "still climbing" trajectory indicator (always visible); (3) hover/tap on the score shows a tooltip: "Top Pick = best opportunity right now, not highest score. High scores below already peaked."
- **Top Pick waiting state:** When no clip qualifies (no fresh >=75 in early_gem/hot_now), the section stays visible with a reduced frame (60% opacity, no crown, no gems, no animations). Shows Radar icon (pulsing amber) + "Radar watching — no early gem right now" + "The crown returns when a fresh clip breaks out". Below: "Freshest contender" mini-card — best clip <12h (any score), with thumbnail, title, @handle, score, age, Steal + Quick Export buttons. If no clip <12h exists at all, just the radar message. Component: `TopPickWaiting` in `top-pick-card.tsx`. Not shown on Saved/Remixes tabs.
- **Top Pick mobile:** Crown scaled 0.7, padding reduced, CTA full-width below content (`sm:hidden`), score 36px.
- **Daily Radar mobile:** 2 lines max — line 1: icon + "DAILY RADAR", line 2: "X exploding · Y legendary · updated Zm ago". Desktop unchanged.

**Single gutter:** Distribution hub CSS: `@media (max-width: 767px) { .dist-page { padding: 0 } }` — inherits `px-4` from dashboard layout, matching Browse (358px usable on 390px). Desktop keeps `padding: 0 24px 48px`.

**Distribution Core (connection map):** `@media (max-width: 720px)` in `distribution-hub.css` — connection map + connector hidden (`display: none`). Replaced by `.dist-mobile-status-card` containing: (1) `.dist-mobile-brain-flow` — vertical diagram: Clip Bank pill (with count) → animated dotted connector → compact 160px brain (outer ring reuses `dist-core-ring-rotate`, wolf silhouette, state-aware glow) → connector → platform pills (TikTok/YouTube/Instagram, active/dim). (2) Status card: header (⚡ AI DISTRIBUTION + active/paused badge), next queued post (title + time + platform), "Schedule →" CTA scrolling to `#dist-queue-section`. Desktop: full brain diagram + SVG paths + platform nodes unchanged.

**Distribution schedule cards (≤860px):** CSS selectors fixed (`.dist-pc-thumb`/`.dist-pc-fit`, was `.pc-thumb`/`.pc-fit` — dead selectors causing overlap). Mobile grid: `70px 1fr auto`, thumbnail + fit% column hidden, title truncated 1 line, reason clamped 2 lines (`-webkit-line-clamp: 2`), pills wrap, match% shown in time column as `.match-mobile` (hidden on desktop).

**Feed tabs fade rail:** Mobile: `mask-image: linear-gradient(to right, black 0%, black 85%, transparent 100%)` on tab container, `pr-8` padding for last-tab reveal, `gap-1.5` spacing. Desktop: no mask, `gap-0.5`, `pr-0.5`. Never wraps to two rows.

**Bottom Layer Manager:** One floating surface at a time on mobile. Priority: render toast > PWA banner.
- `stores/ui-store.ts` tracks `hasActiveRenderToast` (boolean). Browse page syncs it from `quickExport?.status === 'rendering' || renderNotification`.
- PWA `InstallBanner` reads `hasActiveRenderToast` — hides when true. Also hides on Enhance page (not mounted there).
- **PWA banner timing:** `vsp:pwa-sessions` counter in localStorage, incremented per mount. Banner only appears from session >= 2. Dismiss = 7-day cooldown (`vsp:pwa-dismiss` timestamp). `appinstalled` event = permanent hide (1-year cooldown). `beforeinstallprompt` = required for `canInstall`.

**Fixed bottom stacking:** Render toasts/notifications use `inset-x-4 bottom-4 md:left-auto md:right-6` (full-width mobile, right-anchored desktop). Install banner at `bottom-20 z-40` (below toasts at `z-50`).

**Enhance page — Quick Mode (mobile):** On `< lg`, a Quick Mode block (`lg:hidden`) appears above the accordion: "Make it viral" title + amber CTA button → calls the same `applyBestCombo` handler as the desktop AI Optimize button. After optimization: shows summary (caption style · hook status · split ratio · tag) + score. Below it: "── or customize ──" separator. The desktop AI Optimize button is `hidden lg:block` (Quick Mode replaces it on mobile — no duplicate CTAs). Accordion starts collapsed on mobile (`defaultValue: []` when `window.innerWidth < 1024`), full on desktop (`['captions']`).

**Enhance page:** Mobile fixed bottom bar (`lg:hidden`) with Generate CTA always reachable during editing. FFmpeg pipeline on mobile: `hidden md:flex` for 6-stage labels, replaced by compact progress bar: "Rendering — step X/4" + amber gradient bar + current stage name (12px). Desktop keeps full pipeline.

**Modal guards:** `max-h-[90vh] overflow-y-auto` on paywall modal, welcome modal, and `.dist-modal-card`. Onboarding overlay: `overflow-y-auto justify-start py-8`, Skip link above grid on mobile.

**Mobile typography:** No text < 10px on user pages. 8px labels bumped to `text-[10px] md:text-[8px]`: hook overlay/coming-soon labels, segment durations, caption animLabel, hook style descriptions. Exceptions: "AI" pip badges (decorative, inside larger text), platform abbreviations (YT/TK/IG in 16px icons).

**Slider touch targets:** `components/ui/slider.tsx` — input `h-11 md:h-1.5` (44px touch area on mobile, 6px on desktop). Visual thumb unchanged (16px). Rail and fill unchanged.

**Drawer nav items:** `layout.tsx` user nav items: `min-h-[48px] md:min-h-0` (48px touch target on mobile). Active state: `bg-amber-500/10 text-amber-400` with amber icon (replaces `bg-primary/10 text-primary`).

**Responsive grids:** Browse clip grid uses `repeat(auto-fill, minmax(240px, 1fr))` — columns adapt to available width, never below 240px per card (3 cols on portrait 1080px, 4-5 on desktop). Grid cell wrappers have `overflow-hidden` to contain legendary gem ornaments. Thumbnails use `aspect-ratio: 16/9` (no fixed height) so they fill their frame edge-to-edge at any card width. Legendary score (`leg-score-big`) uses CSS `54px` (no inline override). CTA buttons hardened: `whitespace-nowrap overflow-hidden text-ellipsis` on label text (leg-cta, cta-viral, tp-cta-compact) — text never wraps or overflows. Other grids: affiliate stats `grid-cols-2 sm:grid-cols-4`, settings referral `grid-cols-1 sm:grid-cols-3`, caption styles `grid-cols-2 sm:grid-cols-3`, split-screen framing `grid-cols-2 sm:grid-cols-3`. Feed tabs: `overflow-x-auto` with hidden scrollbar + fade mask. Daily Radar: `flex-wrap min-h-14 py-2`.

**Viewport:** `export const viewport` in `app/layout.tsx` — `width: device-width`, `initialScale: 1`, `viewportFit: cover`. Login reset input: `text-base sm:text-xs` (prevents iOS zoom).
