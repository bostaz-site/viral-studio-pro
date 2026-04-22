# Distribution Hub

## Description

The Distribution Hub lets users manage social account connections, schedule clip publications across platforms, view a weekly calendar, browse publication history, and configure distribution settings. Includes anti-shadowban rules (minimum spacing, random variation, no duplicate clips on same platform).

## SQL Tables

### `scheduled_publications`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK -> profiles.id |
| clip_id | TEXT | Clip ID |
| platform | TEXT | 'tiktok' / 'youtube' / 'instagram' |
| caption | TEXT | Nullable, max 2200 chars |
| hashtags | TEXT[] | Array of hashtag strings, max 30 |
| scheduled_at | TIMESTAMPTZ | Publication time (may be adjusted +/-30min) |
| status | TEXT | 'scheduled' / 'publishing' / 'published' / 'failed' / 'cancelled' |
| publish_result | JSONB | Result from platform API |
| error_message | TEXT | Error details if failed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `distribution_settings`

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID | PK (unique per user) |
| max_posts_per_day | INT | Default 3 |
| min_hours_between_posts | FLOAT | Default 3 |
| default_hashtags | TEXT[] | Default hashtags |
| caption_template | TEXT | Template with {title} placeholder |
| niche | TEXT | 'gaming' / 'fps' / 'moba' / 'irl' |
| optimal_hours | JSONB | Per-platform optimal posting hours |
| ai_optimized | BOOLEAN | Whether AI optimization has been applied |
| updated_at | TIMESTAMPTZ | |

### `publications`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| social_account_id | UUID | FK -> social_accounts.id |
| clip_id | TEXT | |
| platform | TEXT | |
| status | TEXT | 'published' / 'failed' |
| published_at | TIMESTAMPTZ | |
| tracking_url | TEXT | Post URL on platform |
| created_at | TIMESTAMPTZ | |

## API Routes

### `GET /api/distribution/schedule`

Returns scheduled publications for the authenticated user. Supports query params: `status`, `platform`, `limit` (max 100), `offset`.

### `POST /api/distribution/schedule`

Creates a new scheduled publication.

**Request body**:
```json
{
  "clip_id": "string",
  "platform": "tiktok" | "youtube" | "instagram",
  "caption": "optional string",
  "hashtags": ["tag1", "tag2"],
  "scheduled_at": "ISO datetime"
}
```

**Anti-shadowban rules enforced**:
1. Minimum 3-hour spacing between posts on the same platform (checks +/- 3h window)
2. No duplicate clip on the same platform (checks scheduled/publishing/published)
3. Random variation: +/- 30 minutes applied to the scheduled time

### `PATCH /api/distribution/schedule`

Updates a scheduled publication (status, time, caption, hashtags).

### `DELETE /api/distribution/schedule?id=...`

Deletes a scheduled publication.

### `GET /api/distribution/settings`

Returns distribution settings for the user. Returns defaults if none exist.

### `PUT /api/distribution/settings`

Upserts distribution settings (max posts/day, min hours, hashtags, caption template, niche, optimal hours).

### `POST /api/distribution/optimize`

AI-powered optimization. Applies niche-specific presets for hashtags, posting hours, caption templates, and spacing. Supported niches: gaming, irl, fps, moba. Sets `ai_optimized: true`.

## UI Components

### `DistributionHub` (`components/distribution/distribution-hub.tsx`)

Main container with 5 tabs: Queue, Calendar, Accounts, History, Settings.

### `ScheduleQueue` (`components/distribution/schedule-queue.tsx`)

**Props**: `{ onAddClick?: () => void }`

Displays the publication queue with status badges (scheduled, publishing, published, failed, cancelled). Supports filter by status. Shows optimal posting hours hint per platform. Cancel and delete actions on queue items.

### `ScheduleCalendar` (`components/distribution/schedule-calendar.tsx`)

**Props**: `{ queue: ScheduledPublication[] }`

7-day calendar grid showing scheduled posts with platform-colored dots.

### `DistributionSettings` (`components/distribution/distribution-settings.tsx`)

Settings form: niche selector, max posts/day, min hours between posts, caption template (with `{title}` placeholder), default hashtags manager (add/remove), "Optimize with AI" button.

### `ScheduleDialog` (`components/distribution/schedule-dialog.tsx`)

Dialog for creating new scheduled publications.

### `PublicationHistory` (`components/distribution/publication-history.tsx`)

List of past publications (published, failed).

### `PublishDialog` (`components/distribution/publish-dialog.tsx`)

Dialog for immediate publish to connected platforms. Used from the enhance page.

## Zustand Stores

### `useScheduleStore` (`stores/schedule-store.ts`)

| Field | Type | Description |
|-------|------|-------------|
| queue | ScheduledPublication[] | All scheduled items |
| queueLoading | boolean | |
| settings | DistributionSettings / null | User's distribution settings |
| analytics | AnalyticsData / null | Analytics data (shared store) |
| fetchQueue(filters?) | action | GET /api/distribution/schedule |
| scheduleClip(data) | action | POST /api/distribution/schedule |
| cancelScheduled(id) | action | PATCH status -> cancelled |
| deleteScheduled(id) | action | DELETE /api/distribution/schedule |
| fetchSettings() | action | GET /api/distribution/settings |
| updateSettings(data) | action | PUT /api/distribution/settings |
| optimizeWithAI(niche?) | action | POST /api/distribution/optimize |
| fetchAnalytics(days?) | action | GET /api/distribution/analytics |

### `useDistributionStore` (`stores/distribution-store.ts`)

Manages social accounts and immediate publishing:

| Field | Type | Description |
|-------|------|-------------|
| accounts | SocialAccount[] | Connected accounts |
| publishTargets | PublishTarget[] | Which platforms to publish to |
| publishProgress | Record<string, PublishProgress> | Per-platform publish status |
| isPublishing | boolean | |
| publishClip(clipId, caption, hashtags) | action | Publishes in parallel to enabled targets |

## User Flow

1. User navigates to `/dashboard/distribution`
2. Connects social accounts in the Accounts tab
3. Configures settings (niche, hashtags, spacing)
4. Schedules publications from the Queue tab or via the enhance page
5. Anti-shadowban rules prevent over-posting
6. Publications appear in the Calendar and History tabs

## Technical Notes

- Anti-shadowban enforces 3h minimum spacing on the same platform
- Random variation (+/- 30min) is applied server-side to scheduled times
- Duplicate clip detection prevents the same clip from being posted twice on the same platform
- AI optimization applies niche-specific presets (not actual ML -- rule-based)
- Optimal posting hours are hardcoded per platform (TikTok: 7h/12h/17h/21h, YouTube: 8h/14h/20h, Instagram: 9h/13h/18h/21h)
