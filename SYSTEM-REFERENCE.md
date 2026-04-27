# SYSTEM-REFERENCE — Feature Flows & Systems

> Documents **how each feature works**: flows, files, state, APIs, dependencies, gotchas.
> For DB schema, env vars, project structure, scoring details and conventions, see `CLAUDE.md`.

---

## 1. Browse / Trending Feed

Dashboard page displaying ranked streamer clips with feed tabs, filters, infinite scroll and hover video preview.

### User Flow
1. Land on `/dashboard` -> `fetchClips()` + `fetchBootstrap()` in parallel. Clips from `GET /api/trending` (200 unfiltered), bootstrap from `GET /api/bootstrap` (saved IDs + recent remixes + profile)
2. Pick a feed tab -> client-side filter first (instant), then background server fetch if <10 results
3. Apply filters (search, platform, niche, duration) -> server-side re-fetch with filter params (search debounced 300ms)
4. Hover on card -> resolves video URL -> inline preview plays
5. **Quick Export** (primary CTA): click lightning bolt -> `POST /api/render/quick` -> renders in background -> notification toast with Download/View on completion
6. **Customize** (secondary): click sliders icon -> `router.push('/dashboard/enhance/{clipId}')` for full enhance editor
7. "Load more" -> `GET /api/trending?cursor={score}_{id}&limit=50` with same filter params

### Files
- `app/(dashboard)/dashboard/page.tsx` — page, feed tabs, upload, remix tab, grid
- `components/trending/trending-card.tsx` — card with hover preview, rank frames, signal tags, velocity stats, social proof, CTA (Quick Export + Customize)
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
- `toggleSaveClip` is optimistic (updates Set immediately, rolls back on API error)
- API supports comma-separated `niche` and `platform` params for multi-value filters
- `expandedGroups: Set<string>` tracks which stream groups are expanded
- `toggleGroup(groupId)` toggles group expansion and re-applies filters
- `applyFilters()` hides `stream_group_collapsed: true` clips unless their group is in `expandedGroups`

### API Endpoints
- `GET /api/bootstrap` — single call replacing 3 fetches: saved clip IDs, last 5 remixes, user profile (plan + usage + bonus). Uses `Promise.allSettled` — partial failure returns empty arrays, never blocks.
- `GET /api/trending` — params: `sort`, `limit` (max 200), `cursor` (format `{score}_{id}`), `niche` (comma-sep), `platform` (comma-sep), `search`, `duration`, `feed`. Response: `{ data, meta: { total, next_cursor } }`. Cursor-based pagination: `(velocity_score, id) DESC` for score sort, `(clip_created_at, id) DESC` for date sort.
- `GET/POST/DELETE /api/clips/saved` — bookmarks CRUD (upsert on conflict `user_id, clip_id`)
- `GET /api/clips/video-url?slug=X` — Twitch GQL `VideoAccessToken_Clip` -> signed CloudFront MP4. In-memory cache (1h TTL)
- `GET /api/clips/my-remixes?limit=20` — user's `render_jobs` enriched with clip metadata + signed download URLs
- `GET /api/clips/sparkline?ids=uuid1,uuid2` — batch snapshots for mini velocity graphs (max 50 clips)

### Feed Tabs
`all` (Film), `hot_now` (Flame), `early_gem` (Diamond), `proven` (Trophy), `recent` (Zap), `saved` (Lock), `remixes` (Scissors). Remixes tab triggers separate `GET /api/clips/my-remixes` fetch.

### Quick Export (Browse -> Render in Background)
Primary CTA on each card. Sends `POST /api/render/quick` with `x-idempotency-key` header (UUID, prevents double-clicks). API runs mood detection (best-effort), builds auto settings from preset, goes through render queue, returns `jobId`. Dashboard subscribes via `useRenderSubscription` and shows a completion toast with Download/View buttons. Auto-dismisses after 15s. Only one quick export at a time per user session (button disabled on other cards while rendering). The "Customize" button (sliders icon) still links to the full enhance page.

### Card Value Props
Each card shows concrete value beyond the raw score:
- **Human velocity**: "+12K/h views" (from `velocity` field, formatted with `formatCount`)
- **Insight tag**: always visible when `getClipInsight()` returns a result (High momentum, Early gem, Spike detected, etc.) + feed category badge (Hot/Gem)
- **Social proof**: "Used by N creators" or "Be the first to export" (from `export_count`)
- **Score number**: big Archivo Black overlay on thumbnail (unchanged)

### Detail Modal Score Breakdown
Collapsible "Why this score" section (`trending-detail-modal.tsx`). Shows top 3 dominant scoring factors (sorted by value desc from momentum, authority, engagement, freshness, early signal, format). Each factor renders as a colored progress bar (green >= 70, amber 40-70, red < 40). Saturation penalty shown separately if > 30. Stats grid includes velocity ("/h") and export count. No extra API call — all data from `TrendingClip`.

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
| 3 | Engagement | 15% | like/view ratio (5%=100, 3%=75, 1%=50). Neutral=65 if no likes. Title signal boost capped at +10% |
| 4 | Recency | 10% | `exp(-age/72)*100`. 6h=92, 24h=72. Never 0 |
| 5 | Early Signal | 10% | views/min * log(views) * exp(-age/6). Short clip bonus 1.1x. Floor at 50 after 24h |
| 6 | Format | 10% | 15-45s=100, 45-60s=80, <10s or >60s=50 |
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

### User Flow
1. Arrive at `/dashboard/enhance/{clipId}` -> load clip from `trending_clips` or `videos`
2. Toggle settings manually OR click "Make it viral" (AI auto-optimization)
3. "Make it viral" -> mood detection (Claude Haiku, 15s timeout) -> hook generation (VPS, 15s) -> auto-render
4. Live CSS preview updates in real-time; "Generate clip" triggers render pipeline
5. On completion: download, publish, or Before/After compare mode

### Files
- `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` — main state machine, all settings, render flow
- `lib/enhance/scoring.ts` — `EnhanceSettings` type, `computeScores()`, `computeCurrentScore()`
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

### Bass Boost & Speed Ramp
**VPS file:** `vps/lib/ffmpeg-render.js` (`buildBassBoostFilters`, `buildSpeedRampFilters`)
- **Bass boost mild**: `bass=g=4:f=80:w=100` + `acompressor` + `alimiter`. Heavy: `bass=g=8:f=60:w=120` + stronger compression + limiter. Always ends chain with `alimiter=limit=0.95` to prevent clipping.
- **Speed ramp subtle**: `setpts=PTS/1.03` (video) + `atempo=1.03` (audio). Dynamic: 1.05x. Changes clip duration — subtitle timestamps must be divided by the speed factor.
- Scoring: mild bass = +0.03, heavy = +0.05; subtle speed = +0.02, dynamic = +0.03

### Adaptive Auto-Cut
**VPS files:** `vps/lib/auto-cut.js` (`classifyIntensity`, `getAdaptiveThreshold`, `applyAutoCut`), `vps/lib/audio-peaks.js`

When auto-cut is enabled and no explicit `silenceThreshold` is provided, the VPS computes an adaptive threshold:
1. Analyze audio peaks via `analyzeAudioPeaks()` (~1-2s)
2. Classify intensity: `high` (>= 0.5 peaks/s), `medium` (>= 0.2), `low`
3. Get base threshold from mood: rage=0.35s, hype=0.40s, funny=0.45s, drama=0.55s, wholesome=0.60s, story=0.70s
4. Adjust by intensity: high=-0.1s, low=+0.1s (clamped 0.3-0.8s)

Frontend passes `mood` in `settings.autoCut.mood`. If user sets an explicit slider value, it overrides the adaptive calculation. UI shows "AI suggests Xs (energy level — mood)" when mood is detected.

### Viral Score Formula
`currentScore = baseline + (headroom * totalWeight)`. Baseline = `max(30, clip.velocity_score)`. Weight accumulates per enabled feature (captions 0.14, split-screen 0.12, hooks 0.11, etc.) with mood-match bonuses. Cap at 99.

### API Endpoints
- `POST /api/enhance/ai-optimize` — mood detection. Returns `{ mood, confidence, explanation, important_words }`
- `POST /api/render/hook` — proxied to VPS. Returns `HookAnalysis { peak, hooks[3], reorder }`

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
- Job lifecycle: `pending` -> `queued` (if no slot) -> `rendering` (VPS picks up) -> `done` | `error` (retriable) | `failed` (dead letter) | `cancelled` (force re-render) | `expired` (storage TTL elapsed)
- Safety: active jobs tracked via Redis Set (idempotent SREM — no counter drift). Each job has a `render:started:{jobId}` key with 900s TTL, renewed by heartbeat. Reconciler cron removes stale entries every 30min
- Functions: `enqueueRender()` (SADD), `releaseJob()` (SREM, idempotent), `processNextInQueue()` (dispatch from queue), `getQueueStatus()` (SCARD)
- Render payload stored in Redis upfront (`render:payload:{jobId}`, TTL 1h) so retries can re-dispatch

### Files
- `app/api/render/route.ts` — validation, quota, queue check, VPS handoff, force re-render
- `app/api/render/quick/route.ts` — skip enhance, auto mood + settings
- `app/api/render/status/route.ts` — poll status, signed URLs, VPS queue position probe, **dispatches next queued job on completion**
- `app/api/render/hook/route.ts` — hook text generation (proxied to VPS) + VPS webhook (retry/dead-letter)
- `app/api/render/heartbeat/route.ts` — VPS heartbeat to keep long renders alive
- `hooks/use-render-subscription.ts` — Realtime subscription (channel `render-jobs`) + polling fallback with adaptive backoff (3s -> 5s -> 10s -> 30s)
- `lib/render-queue.ts` — `enqueueRender()`, `releaseJob()`, `processNextInQueue()`, `getQueueStatus()`
- `lib/api/render-helpers.ts` — shared: `resolveClip()`, `checkExistingJob(force?)`, `enforcePlanLimits()`, `createRenderJob()`, `sendToVps()`

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
- **Key-based**: frontend sends `X-Idempotency-Key` header (UUID via `useRef`). API checks unique index `(user_id, idempotency_key)` — returns existing job if found. Key reset on done/error. Migration: `20260425_idempotency.sql`
- **Force re-render** (`force: true` in POST body): cancels stuck jobs for this clip+user, frees Redis slots, creates fresh job

### Quota
- `try_consume_video_credit(p_user_id, p_max_videos)` RPC: atomic conditional `UPDATE ... WHERE monthly_videos_used < limit`, falls through to `bonus_videos`. No separate check+increment — prevents race conditions. Migration: `20260425_atomic_quota.sql`
- Duration limits: free=30s, pro=5min, studio=unlimited
- Zombie cleanup cron refunds quota via `refund_video_usage` RPC and frees orphaned Redis slots, then dispatches queued jobs

### Timeouts
- **Pending/queued**: 10 minutes (based on `created_at`) — VPS never picked up the job
- **Rendering**: 15 minutes hard timeout (based on `updated_at`) — independent of heartbeat. Even if heartbeat ran at minute 14, if minute 16 is reached the job is killed

### Dependencies
- VPS: `VPS_RENDER_URL` (Railway) — authenticates with `VPS_RENDER_API_KEY`
- Supabase Storage: `clips/` for output, `thumbnails/` for thumbnails
- Supabase Realtime: postgres_changes on `render_jobs` table

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
- **TikTok**: Direct post via `/v2/post/publish/video/init/` (pull-from-URL). Privacy: `SELF_ONLY`
- **YouTube**: Resumable upload (download video -> start session -> upload bytes). Privacy: `private`
- **Instagram**: Stubbed (`supportsPublish: false`)

### Token Manager
`getValidToken(userId, platform)`: checks expiry with 5-min buffer -> auto-refresh if expired. Uses Upstash Redis distributed lock (`SET lock:token:{platform}:{userId} 1 NX EX 30`) to prevent concurrent refreshes across serverless isolates. If lock is held, waits 2s then re-reads the freshly refreshed token from DB. Lock released in `finally` block.

### Posting Time Advice
`lib/distribution/posting-schedule.ts` provides per-platform optimal posting hours (UTC). Integrated into the publish dialog: shows a green/amber/red badge per enabled platform with a suggestion like "Best time to post right now!" or "Low engagement now. Best in 3h". Data is static (based on public research), not personalized.

### Gotchas
- TikTok `publish_id` returns immediately but posting is async
- Google doesn't rotate refresh tokens; TikTok does
- Redis down: lock acquisition falls through (best-effort), refresh proceeds without coordination
- All tokens encrypted AES-256-GCM via `lib/crypto.ts`

---

## 9. Cron Jobs

Netlify Scheduled Functions triggering Next.js API routes. All authenticate via `x-api-key: CRON_SECRET`.

### Schedule
| Function | Cron | Route | Purpose |
|----------|------|-------|---------|
| `cron-fetch-clips` | `0 */3 * * *` | `POST /api/cron/fetch-twitch-clips` | Fetch new Twitch + Kick clips |
| `cron-rescore` | `*/15 * * * *` | `POST /api/cron/rescore-clips` | Stratified rescoring (batch 200) |
| `cron-cleanup-render-jobs` | `*/5 * * * *` | `POST /api/cron/cleanup-render-jobs` | Zombie jobs >10min -> error + refund quota |
| `cron-cleanup-storage` | `0 4 * * *` | `POST /api/cron/cleanup-storage` | Delete expired clips (free=7d, pro=30d, studio=90d) |
| `cron-reset-usage` | `0 0 1 * *` | `POST /api/cron/reset-usage` | Reset `monthly_videos_used` to 0 |
| `cron-reconcile-render` | `*/30 * * * *` | `POST /api/cron/reconcile-render` | Reconcile Redis active jobs Set with DB — remove stale entries, dispatch queued |

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

### Landing Events
`page_view`, `demo_view`, `demo_clip_switch`, `demo_caption_switch`, `demo_split_toggle`, `demo_cta_click`, `cta_hero_click`, `cta_pricing_click`, `cta_signup_click`, `exit_intent_shown/submitted/dismissed`, `changelog_view`, `newsletter_submitted`, `pricing_view`

---

## 11. Auth & Onboarding

Supabase Auth with email/password + Google OAuth, protected routes, welcome modal and referral system.

### Files
- `app/(auth)/login/page.tsx` — `signInWithPassword()`, redirect to `/dashboard`
- `app/(auth)/signup/page.tsx` — referral code capture (URL param -> cookie -> localStorage)
- `middleware.ts` — protects `/dashboard`, `/settings`; redirects authed users from `/login`
- `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR)
- `components/onboarding/welcome-modal.tsx` — 3-step onboarding (localStorage `vsp.onboarding.welcome.v1`)
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
Supabase Broadcast (no DB persistence). Anonymous payload `{ score, rank, platform }`. Auto-hides after 8s. Fire-and-forget — never blocks render flow.

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

Installable web app with offline fallback. Manual service worker (no next-pwa package).

### Files
- `app/manifest.ts` — Next.js route-based manifest (standalone, portrait, orange theme)
- `public/sw.js` — service worker: cache-first for static assets, network-first for pages, offline fallback
- `public/offline.html` — dark mode offline page with retry button
- `public/icons/` — SVG placeholder icons (192, 512, maskable-512). Replace with real PNGs for production
- `hooks/use-pwa-install.ts` — listens to `beforeinstallprompt`, exposes `canInstall` + `promptInstall()`
- `components/pwa/install-banner.tsx` — mobile-only install prompt, dismiss stored in localStorage for 7 days
- `app/layout.tsx` — PWA meta tags (theme-color, apple-mobile-web-app) + SW registration via `next/script`

### Service Worker Strategy
- **Cache-first**: `/icons/`, `/_next/static/`, font files — cached on first load, served from cache thereafter
- **Network-first**: page navigations — falls back to `/offline.html` when offline
- **Never cached**: `/api/*` routes and Supabase requests — always hit the network
- Self-updates via `skipWaiting()` + `clients.claim()`

### Install Banner
- Only shows on mobile (hidden via `md:hidden`)
- Only shows when browser supports install (`beforeinstallprompt` event)
- Dismiss persisted in localStorage `vsp:pwa-dismiss` for 7 days
- Rendered at the bottom of the dashboard page

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
