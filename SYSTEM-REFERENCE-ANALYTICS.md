# SYSTEM REFERENCE — Analytics Page (v5.1)

> Source of truth for the Analytics page.
> v5.1: TikTok tracker env flag + persistent Apply adjustments.
> Derniere mise a jour : 2026-07-02.

---

## 1. TL;DR + Philosophy

Analytics is the **Learning Engine** of Viral Animal. It answers:
> "What's working? What's not? What should I change?"

**Core principle: the page never feels empty.** Every state — from 0 posts to 30+ — guides the user toward the next meaningful action. Locked sections are PROMISES with checklists, not blurred fake data.

Data flow: `published_posts` (Supabase) -> `pattern-detector.ts` (server aggregation) -> `/api/analytics/profile` (cached 1h) -> UI (charts + adjustments).

---

## 2. Architecture

| File | Lines | Role |
|---|---|---|
| `app/(dashboard)/dashboard/analytics/page.tsx` | ~23 | Page wrapper (Suspense + metadata) |
| `components/analytics/analytics-dashboard.tsx` | ~732 | Main orchestrator — all 10 sections, data fetching, derived state |
| `components/analytics/creator-rank-hero.tsx` | ~247 | Hero: score ring SVG, rank label, progression bar, sync, count-up animation |
| `components/analytics/charts/insight-bar-chart.tsx` | ~84 | Recharts horizontal bar chart — best/worst patterns |
| `components/analytics/charts/posting-heatmap.tsx` | ~141 | Custom CSS grid heatmap — hour x weekday performance |
| `components/analytics/charts/progression-line-chart.tsx` | ~87 | Recharts area chart — score/followers over time (ready, not yet wired) |
| `lib/analytics/pattern-detector.ts` | ~327 | Server-side: `computeProfileForUser()` -> `LearnedDistributionProfile` |
| `app/api/analytics/profile/route.ts` | ~24 | GET endpoint, withAuth, in-memory cache 1h TTL, `?force=true` bypass |
| `lib/analytics/trackers/youtube.ts` | — | YouTube Data API tracker (WIRED_REAL) |
| `lib/analytics/trackers/tiktok.ts` | — | TikTok Video Query API tracker (PENDING) |
| `lib/analytics/trackers/meta.ts` | — | Instagram Graph API tracker (PENDING) |
| `app/api/cron/refresh-post-stats/route.ts` | — | Cron: batch refresh metrics from platform APIs (every 6h) |
| `types/learning.ts` | ~106 | Types: ConfidenceLevel, LearnedDistributionProfile, LearnedInsight, AccountBreakdown |
| `stores/account-store.ts` | — | Zustand: Creator Rank, YouTube stats, sync actions |
| `supabase/migrations/20260503_published_posts.sql` | — | Table `published_posts` — clip metadata + metrics snapshot |

---

## 3. Layout (top to bottom)

```
1. Creator Rank Hero (conditional: renders only when hasYouTube)
   |- Score ring SVG (80px, count-up 0->score, 800ms easeOutCubic)
   |- Rank label (gradient text + emoji: Scout/Hunter/Alpha/Apex/Legend)
   |- Progression bar (animated width to next threshold)
   |- Sync Now button + last sync time

2. Next Unlock card (cyan accent)
   |- Progress bar with stripe animation (actively collecting)
   |- Dynamic: "Next unlock: What's Working — 0/5" or "Full learning active"

3. Learning Status (compact bar)
   |- "N accounts · N tracked posts · Xh ago"
   |- Streak badge, confidence pill, sync stale warning
   |- Inline CTA if 0 accounts or 0 posts

4. Smart Queue Adjustments (PROMOTED — position #4)
   |- Unlocked: cards with Apply button (border-l cyan, hover lift)
   |- Locked: "No adjustments yet" + explanation (max 180px)

5. Smart Queue Influence Indicator
   |- 4-segment bar: Ignored / Soft hint / Strong / Full reorder
   |- Current stage highlighted cyan

6. What's Working
   |- Unlocked: Top Insight card + InsightBarChart (top 6)
   |- Locked: preview checklist (moods, platforms, formats) — max 220px

7. Best Posting Times
   |- Unlocked: PostingHeatmap + best window conclusion
   |- Locked: time window checklist (4 buckets) — max 220px

8. What's Not Working
   |- Unlocked: structured cards per underperformer (red border-l, hover lift)
   |- Locked: "Once 5 tracked posts..." — max 180px

9. Connected Accounts (grid 1-3 cols)
   |- YouTube: score + rank + last sync
   |- TikTok/Instagram: "Waiting for API approval"

10. Post History (table, max 20 rows)
    |- Columns: Clip, Source, Score, Tracking (pending badge), Posted
```

---

## 4. Visual Brand

| Element | Color |
|---|---|
| Primary accent | Cyan `#38BDF8` |
| Score/urgency | Orange `#F97316` |
| Underperformers | Red `#EF4444` (dim) |
| Glass cards | `bg-card/60`, `border-border`, `backdrop-blur` |
| Locked sections | Compact preview cards with checklists (no blur, no fake data) |
| Text hierarchy | White > zinc-300 > zinc-500 > zinc-700 |
| Instagram gradient | `from-pink-600 to-purple-600` (platform brand, not theme violation) |

### Creator Ranks (rebranded 2026-05-05)

| Rank | Threshold | Color | Emoji |
|---|---|---|---|
| Scout | >= 0 | zinc/gray | paw |
| Hunter | >= 20 | amber/bronze | target |
| Alpha | >= 40 | cyan | lightning |
| Apex | >= 60 | gold/amber | fire |
| Legend | >= 80 | orange-red-pink gradient | crown |
| Hidden Gem | perf > 80 AND audience < 55 | orange fire | gem |

---

## 5. Hero Creator Rank

- **Score Ring**: SVG 80x80, `strokeDasharray` animated via rAF (800ms easeOutCubic)
- **Count-up**: 0 -> actual score, respects `prefers-reduced-motion`
- **Rank Label**: gradient text from `RANK_GRADIENT` map + emoji
- **Progression Bar**: 6px, animated width (800ms), label "X / Y to NEXT — N pts away"
- **Growth Trend**: optional `scoreDelta` prop (+N cyan, -N red, stable gray)
- **Sync Button**: cyan when available, gray disabled, spin animation while syncing
- **Responsive**: `flex flex-wrap` — wraps naturally below 768px

---

## 6. Confidence System

Based on **tracked posts** (`published_posts WHERE views IS NOT NULL`), not total clips.

| Level | Posts | Badge | Color |
|---|---|---|---|
| none | 0 | No data | zinc |
| collecting | 1-4 | Collecting signals | zinc |
| early | 5-14 | Early signals | amber |
| medium | 15-29 | Medium confidence | blue |
| high | 30+ | High confidence | emerald |

Source: `profile.totalPostsAnalyzed` from `/api/analytics/profile`.

---

## 7. Next Unlock Card

Dynamic card showing distance to next milestone:

| Tracked posts | Shows | Target |
|---|---|---|
| 0-4 | "Next unlock: What's Working" | 5 |
| 5-14 | "Next unlock: Medium confidence" | 15 |
| 15-29 | "Next unlock: Full learning" | 30 |
| 30+ | "Full learning active" (emerald badge, no progress bar) | — |

Progress bar has animated stripe pattern (`analytics-stripe-bar` CSS animation).

---

## 8. Smart Queue Influence Indicator

4-segment horizontal bar showing Learning Engine impact on distribution:

| Stage | Posts | Weight |
|---|---|---|
| Ignored | 0-4 | 0% |
| Soft hint | 5-14 | 30% |
| Strong influence | 15-29 | 70% |
| Full reorder | 30+ | 100% |

Current stage highlighted with cyan fill. Description text below.

---

## 9. Locked States Design

**NO blurred fake data.** Locked sections use:
- Preview cards with checklists ("What we'll detect: ...")
- Max height enforced (180-220px)
- Clear progress messaging ("Publish N more clips to unlock")
- No Lock icon overlays, no `blur-[2px]`, no mock chart data
- Every section guides the next action

---

## 10. Charts

### InsightBarChart
- Recharts `BarChart layout="vertical"`
- Color: orange (2x+), cyan (1.3-2x), dim (<1.3x)
- Used in: What's Working (top 6 patterns)

### PostingHeatmap
- Custom CSS grid: columns x rows (time buckets)
- Cell colors: orange (2x+), cyan (1.3-2x), red (<1x), zinc (no data)
- Used in: Best Posting Times

### ProgressionLineChart
- Recharts AreaChart, cyan gradient fill
- Ready but not yet wired (needs 4+ weekly snapshots)

---

## 11. Pattern Detection Engine

`lib/analytics/pattern-detector.ts` — server-side aggregation.

### `computeProfileForUser(userId)` -> `LearnedDistributionProfile`
1. Query `published_posts WHERE user_id = ? AND views IS NOT NULL`
2. Compute `userAvgViews`
3. Aggregate: bestMoodsByPlatform, bestPostingWindows, bestCaptionStyles, underperformingPatterns (min 5 posts per pattern)
4. Generate adjustments from cross-analysis
5. Return typed profile

### Smart Queue consumption
Profile is fetched by `queue-store.ts` via `GET /api/analytics/profile` and passed to `generateQueue()` as `learnedProfile`. The engine applies boosts/penalties weighted by confidence (30%/70%/100%).

---

## 12. API Trackers

| Platform | File | API | Status |
|---|---|---|---|
| YouTube | `lib/analytics/trackers/youtube.ts` | `videos.list?part=statistics` | WIRED_REAL |
| TikTok | `lib/analytics/trackers/tiktok.ts` | Video Query API v2 | GATED (`TIKTOK_VIDEO_LIST_APPROVED=true`) |
| Instagram | `lib/analytics/trackers/meta.ts` | Graph API + Insights | PENDING |

Cron: `POST /api/cron/refresh-post-stats` every 6h, batch 100 posts, auth via `CRON_SECRET`.

---

## 13. Cache Invalidation

`/api/analytics/profile` uses in-memory cache, 1h TTL.
- `?force=true` bypasses cache (used after Sync Now)
- Flow: syncAccount() -> success -> fetch with force=true -> setProfile(fresh)

---

## 14. Statut par Feature

| Feature | Status |
|---|---|
| Creator Rank Hero (ring, progression, sync) | WIRED_REAL |
| Next Unlock card | WIRED_LOCAL (based on trackedPosts) |
| Learning Status bar | WIRED_REAL |
| Smart Queue Adjustments (with Apply) | WIRED_REAL (persisted in queue-store settings.appliedAdjustments, +10 priority boost) |
| Smart Queue Influence Indicator | WIRED_LOCAL |
| InsightBarChart (What's Working) | WIRED_REAL (pattern-detector) |
| PostingHeatmap (Best Times) | WIRED_REAL (bestPostingWindows) |
| What's Not Working cards | WIRED_REAL (underperformingPatterns) |
| Connected Accounts breakdown | WIRED_REAL (YouTube score+rank, others locked) |
| Post History table | WIRED_REAL (render_jobs + trending_clips) |
| Published posts logging | WIRED_REAL (INSERT on publish) |
| YouTube stats tracker (cron) | WIRED_REAL |
| TikTok/Instagram trackers | PENDING (scope approval) |
| Pattern detection engine | WIRED_REAL |
| Smart Queue profile consumption | WIRED_REAL |
| ProgressionLineChart | READY (needs snapshot data) |
| Stripe animation (Next Unlock) | WIRED_REAL |
| Hover lift + glow (cards) | WIRED_REAL |
| prefers-reduced-motion | WIRED_REAL |

---

## 15. Systemes connexes

| Systeme | Relation |
|---|---|
| **published_posts** | Source de verite des stats — alimente par publish manuel + autofarm executor |
| **refresh-post-stats** | Cron 6h qui refresh les metriques depuis les APIs plateforme |
| **pattern-detector** | Analyse les stats → genere le LearnedDistributionProfile |
| **Smart Queue** | Consomme le profile + appliedAdjustments pour reordonner la queue |
| **Creator Rank** | Score YouTube (account-scorer) affiche dans le hero |
| **TikTok tracker** | Gate derriere `TIKTOK_VIDEO_LIST_APPROVED` (env flag) |

---

## 16. Axes d'amelioration

1. **ProgressionLineChart**: Wire once 4+ weekly snapshots exist per user
2. **TikTok/Instagram API**: Pending scope approval, code ready (tracker gated by env flag)
3. **Heatmap multi-platform**: Split by platform when enough data per platform
4. **A/B testing insights**: Compare caption variants with real results
5. **Refresh Stats button**: Enable when at least 1 API tracker is approved
