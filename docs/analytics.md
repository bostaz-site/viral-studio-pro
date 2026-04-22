# Analytics

## Description

The analytics dashboard shows distribution performance metrics: total published/scheduled/failed publications, daily publication chart, per-platform breakdown, top clips, and a Viral Account Score (0-100) based on posting regularity, platform diversity, and volume.

## SQL Tables

Uses the same tables as the Distribution Hub:

- **`publications`** -- Actual published clips (via social_accounts)
- **`scheduled_publications`** -- Scheduled/pending clips

See [distribution-hub.md](distribution-hub.md) for column details.

## API Routes

### `GET /api/distribution/analytics`

Protected via `withAuth`. Query param: `days` (default 30, max 90).

**Response**:
```json
{
  "data": {
    "totalPublished": 12,
    "totalScheduled": 3,
    "totalFailed": 1,
    "thisWeekPubs": 5,
    "viralScore": 65,
    "dailyStats": [{ "date": "2026-04-14", "count": 2 }, ...],
    "platformStats": {
      "tiktok": { "published": 5, "scheduled": 1, "failed": 0 },
      "youtube": { "published": 4, "scheduled": 2, "failed": 1 },
      "instagram": { "published": 3, "scheduled": 0, "failed": 0 }
    },
    "topClips": [{ "clip_id": "...", "platforms": ["tiktok", "youtube"], "count": 2 }]
  }
}
```

## Viral Score Formula

The Viral Account Score (0-100) is computed server-side:

| Component | Max Points | Calculation |
|-----------|-----------|-------------|
| Regularity | 40 | `min(thisWeekPubs * 10, 40)` |
| Diversity | 45 | `platformsWithPublished * 15` |
| Volume | 15 | `min(totalPublished * 2, 15)` |
| **Total** | **100** | `min(regularity + diversity + volume, 100)` |

Score labels:
- 80-100: "Excellent" (green)
- 60-79: "Good" (blue)
- 40-59: "Growing" (amber)
- 0-39: "Getting Started" (red)

## UI Components

### `AnalyticsDashboard` (`components/analytics/analytics-dashboard.tsx`)

Main container. Fetches analytics via `useScheduleStore.fetchAnalytics(30)`. Renders:
- 4 stat cards (Total Published, Scheduled, This Week, Failed)
- Publications chart (2/3 width) + Viral Score ring (1/3 width)
- Platform stats grid
- Top clips list

### `PublicationsChart` (`components/analytics/publications-chart.tsx`)

**Props**: `{ data: { date: string; count: number }[] }`

Bar chart showing daily publications for the last 7 days.

### `PlatformStats` (`components/analytics/platform-stats.tsx`)

**Props**: `{ stats: Record<string, { published: number; scheduled: number; failed: number }> }`

Per-platform breakdown with colored bars (TikTok, YouTube, Instagram).

### `TopClips` (`components/analytics/top-clips.tsx`)

**Props**: `{ clips: { clip_id: string; platforms: string[]; count: number }[] }`

Lists top 5 clips by number of platforms they were published on.

### `ViralScore` (`components/distribution/viral-score.tsx`)

**Props**: `{ score: number }`

Circular progress ring with score number, label, and description. SVG-based with animated stroke.

## Zustand Store

Analytics data lives in `useScheduleStore`:

| Field | Type |
|-------|------|
| analytics | AnalyticsData / null |
| analyticsLoading | boolean |
| fetchAnalytics(days?) | action -> GET /api/distribution/analytics |

## Key Files

| File | Role |
|------|------|
| `app/(dashboard)/dashboard/analytics/page.tsx` | Page wrapper |
| `components/analytics/analytics-dashboard.tsx` | Dashboard layout |
| `components/analytics/publications-chart.tsx` | Daily bar chart |
| `components/analytics/platform-stats.tsx` | Per-platform stats |
| `components/analytics/top-clips.tsx` | Top clips table |
| `components/distribution/viral-score.tsx` | Score ring widget |
| `app/api/distribution/analytics/route.ts` | API endpoint |
| `stores/schedule-store.ts` | Store (analytics slice) |

## User Flow

1. User navigates to `/dashboard/analytics`
2. Dashboard fetches 30 days of analytics data
3. Displays overview stats, publication chart, platform breakdown
4. Viral Score ring shows overall account health

## Technical Notes

- Viral Score is fully server-computed (no client-side calculation)
- Daily stats are computed for the last 7 days only (even if 30 days of data is fetched)
- Platform diversity counts platforms with at least 1 published post
- Analytics query joins `publications` (via `social_accounts`) and `scheduled_publications`
