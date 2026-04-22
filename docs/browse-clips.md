# Browse Clips V2

Intelligent clip discovery system with Kick integration, 5-factor scoring, smart feeds, favorites, and admin panel.

## Scoring Engine (5 Factors)

All scoring logic is in `lib/scoring/clip-scorer.ts`, shared by Twitch and Kick pipelines.

### Factor 1: Velocity Score (35%)
```
velocity = delta_views / hours_elapsed
velocity_score = 15 * log10(max(1, velocity)) + 10
Capped to 0-100
```

### Factor 2: Viral Ratio (20%)
```
viral_ratio = velocity / (view_count + 1)
viral_ratio_score = min(100, viral_ratio * 10000)
```

### Factor 3: Recency Boost (15%)
```
< 2h:   100
2-6h:   80 → 50 (linear decay)
6-24h:  50 → 20
24-48h: 20 → 0
> 48h:  0
```

### Factor 4: Early Signal Score (15%)
Only active for clips < 2 hours old. Detects clips that WILL explode.
```
views_per_minute = view_count / age_minutes
early_signal = min(100, views_per_minute * 50)

Boost if like_ratio > 10%: x1.3
Boost if like_ratio > 15%: x1.5
```

### Factor 5: Anomaly Score (15%)
Compares clip to its streamer's average performance.
```
view_ratio = view_count / streamer_avg_views
velocity_ratio = velocity / streamer_avg_velocity
anomaly = (view_ratio - 1) * 30 + (velocity_ratio - 1) * 40
```

### Final Score
```
final = velocity*0.35 + viral_ratio*0.20 + recency*0.15 + early_signal*0.15 + anomaly*0.15
```

### Tiers
| Tier | Score Range |
|------|-------------|
| mega_viral | >= 90 |
| viral | >= 75 |
| hot | >= 60 |
| rising | >= 40 |
| normal | >= 15 |
| dead | < 15 |

## 3 Smart Feeds

| Feed | Criteria | Use Case |
|------|----------|----------|
| Hot Right Now | feed_category='hot_now': velocity>=70 AND age<6h | Clips exploding NOW |
| Early Gems | feed_category='early_gem': age<2h AND early_signal>=60 | Find clips BEFORE they blow up |
| Proven Viral | feed_category='proven': score>=60 AND age>6h | Safe to repost, already validated |

## Platform Support

### Twitch
- Uses Helix API (official, with Client Credentials auth)
- Auto-resolves broadcaster IDs from login names
- Client: `lib/twitch/client.ts`
- Pipeline: `lib/twitch/fetch-streamer-clips.ts`

### Kick
- Uses unofficial API (no auth needed, public clips)
- `GET https://kick.com/api/v2/channels/{username}/clips`
- 10s timeout, graceful fallback on errors
- Client: `lib/kick/client.ts`
- Pipeline: `lib/kick/fetch-kick-clips.ts`

## Streamers

### Twitch IRL (23 total)
Existing: kaicenat, ishowspeed, xqc, adinross, jynxzi, sketch, amouranth, hasanabi, marlon
New: stabletronaldo, plaborttv, dukedennis, faborttv, lacyfn, yourragegaming, thefoufou, iamtherealak, zackttg, jasontheween, caseoh_, dd_osama, agent00, brucedropemoff

### Kick IRL (10 total)
neon, clavicular, adin, braden, samf, fousey, sneako, johnnysomali, suspendedceo, vitaly

### Streamer Averages
After each fetch, per-streamer averages are recalculated:
- `avg_clip_views`: mean of last 50 clips' view_count
- `avg_clip_velocity`: mean of last 50 clips' velocity
- `total_clips_tracked`: count of clips in trending_clips for this streamer

Top streamers (priority >= 10) have `fetch_interval_minutes` of 5-10.

## Favorites System

### Table: `saved_clips`
```sql
CREATE TABLE saved_clips (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    clip_id UUID REFERENCES trending_clips(id),
    notes TEXT,
    created_at TIMESTAMPTZ,
    UNIQUE(user_id, clip_id)
);
```

### API
- `GET /api/clips/saved` — List saved clips with joined trending_clips data
- `POST /api/clips/saved` — Save a clip `{ clip_id, notes? }`
- `DELETE /api/clips/saved/{clip_id}` — Unsave

### UI
- Bookmark icon on each TrendingCard (hover to reveal)
- "Saved" feed tab on dashboard
- Optimistic toggle with rollback on error

## Duration Filter

| Filter | Range | Use Case |
|--------|-------|----------|
| Short | < 30s | TikTok |
| Medium | 30-60s | YouTube Shorts |
| Long | 60s+ | YouTube / compilations |

## Infinite Pagination

- Initial fetch: 100 clips
- "Load more" button shows remaining count
- Appends 50 clips per batch
- Store tracks `hasMore`, `loadingMore`, `totalCount`

## Admin Panel — Streamers

Page: `/admin/streamers` (protected by `isAdminEmail()`)

### Features
- Table of all streamers: name, platform badges, priority, clips count, avg views, last fetched
- Add Streamer dialog: display_name, twitch_login, kick_login, priority
- Actions per streamer: toggle active, delete, "Fetch Now" (immediate fetch)
- Stats header: total, active, total clips, inactive

### API
- `GET /api/admin/streamers` — List all
- `POST /api/admin/streamers` — Create
- `PATCH /api/admin/streamers/{id}` — Update
- `DELETE /api/admin/streamers/{id}` — Remove
- `POST /api/admin/streamers/{id}/fetch` — Trigger immediate fetch

## SQL Migration

File: `supabase/migrations/20260421_browse_clips_v2.sql`

### Changes
- `streamers` table: added `avg_clip_views`, `avg_clip_velocity`, `total_clips_tracked`, `kick_login`, `last_fetched_at`, `fetch_interval_minutes`, `niche`
- `trending_clips` table: added `early_signal_score`, `anomaly_score`, `feed_category`
- New `saved_clips` table with RLS
- Indexes on feed_category, early_signal_score, kick_login, saved_clips
- Inserted 14 new Twitch streamers + 10 Kick streamers
- Updated top 6 Twitch streamers to priority=10

## Component Changes

### `TrendingCard`
- Platform badge: Twitch (purple) or Kick (green)
- Duration display (e.g. "0:24")
- Clip creation time instead of scraped time
- Tier badges: mega_viral (gold animated), viral (red), hot (orange), rising (green)
- Feed category badges: Early Gem (cyan), Hot Now (orange animated)
- Bookmark button on hover
- New streamer gradients

### `TrendingFilters`
- Added Kick platform pill
- Duration filter pills (Short/Medium/Long)
- Feed tab integration

### `TrendingDetailModal`
- All 5 score factors displayed as progress bars
- Feed category with explanation
- Duration display
- Clip creation date (not scraped date)

### `TrendingStats`
- Kick in platform breakdown bar

### Dashboard Page
- 6 feed tabs: All, Hot Right Now, Early Gems, Proven Viral, Recent, Saved
- "Load more" button with remaining count
- Bookmark toggle on each card
