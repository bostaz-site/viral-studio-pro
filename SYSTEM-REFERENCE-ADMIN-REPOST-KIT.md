# SYSTEM REFERENCE — Repost Kit (V3-1B)

> Public, mobile-first page for creators to download, repost, and earn commission.
> URL: `/partner/repost/[handle]` — no auth required, tracked via session.
> Derniere mise a jour: Mai 2026.

---

## Architecture

### Pages

| Route | File | Render | Description |
|---|---|---|---|
| `/partner/repost/[handle]` | `app/partner/repost/[handle]/page.tsx` | SSR | Create session, lookup influencer, pass data to client |

### Client Components

| File | Description |
|---|---|
| `_components/repost-kit-client.tsx` | Main orchestrator — 12 sections, tracker init |
| `_components/video-player-tracked.tsx` | Video with milestone tracking (25/50/75/100%) + download buttons |
| `_components/code-copy-card.tsx` | Promo code card with copy button |
| `_components/caption-card.tsx` | FTC-compliant caption + hashtags with copy |
| `_components/progress-tracker.tsx` | 3-step progress (Download/Copy/Submit) |
| `_components/projected-commission.tsx` | Commission projection display |
| `_components/mobile-actions.tsx` | One-tap TikTok/IG/YouTube links |
| `_components/submit-post-form.tsx` | Post URL submission form |
| `_components/social-proof.tsx` | "X creators reposted" + top earner |
| `_components/customize-button.tsx` | Request different angle |

### API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/partner/repost/events` | None | Batch insert tracking events |
| `POST` | `/api/partner/repost/submit` | None | Submit post URL |

### Library

| File | Description |
|---|---|
| `lib/partner/repost-kit/session.ts` | Create + get kit sessions |
| `lib/partner/repost-kit/tracker.ts` | Client-side event batcher (5s flush + immediate for critical) |
| `lib/partner/repost-kit/projected-commission.ts` | Commission projection calculator |

---

## Page Layout (12 Sections, Mobile-First)

```
+-------------------------------+
| Hi {{name}}                   |
| Your repost kit is ready      |
+-------------------------------+
| [1] Download  [2] Copy  [3]  |
|     Submit   (progress bar)   |
+-------------------------------+
| [VIDEO PLAYER 9:16]           |
| Time to post: ~45 seconds     |
| [Download HD] [Download Mobile|
+-------------------------------+
| Your Promo Code               |
| [VIRAL-HANDLE]  [Copy]        |
| 30% recurring commission      |
+-------------------------------+
| Caption (FTC compliant)       |
| [Copy Caption]                |
| Hashtags                      |
| [Copy Hashtags]               |
+-------------------------------+
| Projected Commission          |
| $X — $Y /mo                   |
+-------------------------------+
| 47 creators posted this video |
+-------------------------------+
| [TikTok] [Instagram] [YouTube]|
+-------------------------------+
| Submit Your Post Link         |
| [https://...] [Submit Post]   |
+-------------------------------+
| Want a different angle?       |
+-------------------------------+
| Need help reposting?          |
+-------------------------------+
```

---

## Tracking Events (16 types)

| Event | Trigger | Critical? |
|---|---|---|
| `kit_viewed` | Page load | No |
| `video_played` | Video play starts | No |
| `video_25_percent` | Watched 25% | No |
| `video_50_percent` | Watched 50% | No |
| `video_75_percent` | Watched 75% | No |
| `video_completed` | Watched 100% | No |
| `download_hd_clicked` | HD download button | Yes |
| `download_mobile_clicked` | Mobile download button | Yes |
| `caption_copied` | Caption copy button | Yes |
| `code_copied` | Promo code copy button | Yes |
| `hashtags_copied` | Hashtags copy button | No |
| `platform_opened` | TikTok/IG/YouTube opened | No |
| `post_url_submitted` | Post URL submitted | Yes |
| `customization_requested` | Different angle requested | No |
| `angle_changed` | Angle variant switched | No |
| `help_clicked` | Help section opened | No |

### Tracking Strategy

- Client-side batch queue, flushed every 5 seconds
- Critical events (downloads, copies, submissions) flush immediately
- `navigator.sendBeacon` on page unload for reliability
- Events capped at 50 per batch

### Drop-off Analysis

| Pattern | Diagnosis |
|---|---|
| Drop between video_25 and video_75 | Video mid-hook problem |
| download without caption_copied | Caption friction |
| download without post_submitted | Posting friction (FTC fear?) |
| Many customization_requested | Angle mismatch |

---

## Session Flow

```
1. GET /partner/repost/[handle] (SSR)
2. Lookup influencer by platform_handle or affiliate_code
3. Create repost_kit_sessions row (anonymous, IP hashed)
4. Pass sessionId to client component
5. Client inits tracker with sessionId
6. Events batched and sent to /api/partner/repost/events
7. Post URL submitted via /api/partner/repost/submit
```

Optional `?c={campaign_id}` query param for campaign attribution.

---

## FTC Compliance

Caption always includes:
- `#ad` disclosure tag
- `#sponsored` disclosure tag
- Green shield icon indicating compliance

This is non-removable — baked into the caption template.

---

## Commission Projection

Formula:
```
views = influencer.audience_size (or 5000 default)
signups = views * 0.002 (0.2% conversion)
monthly_low = signups * $24 avg * 30% * 0.5 (conservative)
monthly_high = signups * $24 avg * 30% * 1.5 (optimistic)
```

---

## Database

### Table: `repost_kit_sessions`

Migration: `supabase/migrations/20260602_repost_kit_tracking.sql`

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Session ID |
| influencer_id | UUID FK | Target influencer |
| promo_video_id | UUID | Video reference (nullable for prototype) |
| campaign_id | UUID FK | Campaign attribution (optional) |
| session_token | TEXT UNIQUE | Session identifier |
| user_agent | TEXT | Browser info |
| ip_hash | TEXT | Hashed IP (privacy) |
| started_at | TIMESTAMPTZ | Session start |
| last_activity_at | TIMESTAMPTZ | Last event |
| post_url | TEXT | Submitted post URL |
| post_submitted_at | TIMESTAMPTZ | When post was submitted |

### Table: `repost_kit_events`

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Event ID |
| session_id | UUID FK | Parent session |
| event_type | TEXT | One of 16 valid types |
| metadata | JSONB | Extra data (platform, post_url, etc.) |
| occurred_at | TIMESTAMPTZ | When event occurred |

---

## Prototype V1 Behavior

- Video URL is `null` — shows "Preview video coming soon" placeholder
- Social proof uses placeholder data (top earner $1,240)
- Commission projection uses audience_size from influencer or defaults to 5,000
- Caption/hashtags auto-generated from niche

---

## Security

- No auth required (public page — accessible via email link)
- IP hashed with ENCRYPTION_SECRET pepper (no raw IPs)
- Session token is opaque random bytes, not JWT
- Events validated against whitelist (16 types)
- Events capped at 50 per batch (DoS protection)
- Post URL validated as valid URL

---

*Document version 1.0 — Mai 2026*
*Branch: feature/acquisition-v3-repost-kit*
