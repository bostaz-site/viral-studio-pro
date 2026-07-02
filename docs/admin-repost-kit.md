# Partner Repost Kit

Version: 1.0 — 2026-07-02

## What It Does

Mobile-first page for influencer partners to download a promo video, copy a pre-made caption with FTC-compliant disclosure (#ad), and submit the link to their reposted content. On submit, the system updates the match engine KPI, advances the influencer's CRM status, and notifies via Discord.

URL: `/partner/repost/[handle]` (public, no auth required — session-based tracking)

## Post-Submit Chain

When the partner submits their post URL (`POST /api/partner/repost/submit`), the following side effects trigger in sequence (each in independent try/catch — a failure in one never blocks the others or the HTTP response):

1. **Session update**: `repost_kit_sessions.post_url` + `post_submitted_at` set. Event `post_url_submitted` logged to `repost_kit_events`.

2. **video_assignment_log**: If the session has a `promo_video_id`, `posted_at` is set on the matching `video_assignment_log` row (by `influencer_id` + `promo_video_id`). This is the `first_post_rate` KPI consumed by the Match Engine's saturation check.

3. **generated_offers**: The most recent offer for this influencer with status IN (`sent`, `opened`, `replied`) is updated to status `posted`.

4. **influencers status** (anti-retrogradation): Status is advanced to `onboarded` ONLY if the current status is one of: `replied`, `interested`, `demo_sent`, `evaluating`. Higher statuses (`onboarded`, `active`, `paying`) are never overwritten. `last_active_at` is always updated.

5. **Discord notification**: Posted to the `conversions` channel (`DISCORD_CONVERSIONS_CHANNEL_ID` env var) with: handle, post URL, status transition.

## Social Proof

The `<SocialProof>` component receives real data from the server:

- **repostCount**: `COUNT(repost_kit_sessions WHERE post_url IS NOT NULL)` — all-time, not time-windowed. Component self-hides when count is 0.
- **topEarner**: `MAX(influencers.total_commission_earned_cents) WHERE affiliate_code IS NOT NULL AND total_commission_earned_cents > 0`. Displays as monthly amount. Shows 0 (hidden) when no earners exist yet.

No hardcoded placeholders. Zero data = zero displayed = component hidden.

## Commission Projection

`lib/partner/repost-kit/projected-commission.ts` calculates:
- `views` = audience_size (or 5000 default)
- `signups` = views x 0.2% conversion rate (min 1)
- `monthlyLow` = signups x $24 x 30% x 0.5
- `monthlyHigh` = signups x $24 x 30% x 1.5

Disclaimer shown below the projection: "Estimate based on audience size — not a guarantee. Actual earnings depend on your audience's response."

## Architecture

### Pages
- `/partner/repost/[handle]` — Server component that looks up influencer, creates session, fetches social proof, renders `<RepostKitClient>`

### Components (`app/partner/repost/[handle]/_components/`)
| Component | Purpose |
|-----------|---------|
| `repost-kit-client.tsx` | Main orchestrator (progress tracker, video, code, caption, commission, social proof, submit) |
| `video-player-tracked.tsx` | Video player with 25/50/75/100% tracking events |
| `code-copy-card.tsx` | Promo code copy card |
| `caption-card.tsx` | Caption + hashtags with copy button |
| `projected-commission.tsx` | Commission range display + disclaimer |
| `social-proof.tsx` | "X creators posted this" + top earner |
| `submit-post-form.tsx` | Post URL input + submit button |
| `progress-tracker.tsx` | 3-step progress (download, copy, submit) |
| `mobile-actions.tsx` | Mobile-specific action buttons |
| `customize-button.tsx` | Customization request CTA |

### API Routes
- `POST /api/partner/repost/submit` — Submit post URL + trigger side effects
- `GET /api/partner/repost/events` — List events for a session

### Tracking Events (16 types in `repost_kit_events`)
`kit_viewed`, `video_played`, `video_25_percent`, `video_50_percent`, `video_75_percent`, `video_completed`, `download_hd_clicked`, `download_mobile_clicked`, `caption_copied`, `code_copied`, `hashtags_copied`, `platform_opened`, `post_url_submitted`, `customization_requested`, `angle_changed`, `help_clicked`

### Database Tables
- `repost_kit_sessions` — Per-visit session (influencer_id, promo_video_id, campaign_id, post_url, post_submitted_at)
- `repost_kit_events` — Granular event tracking (16 types)

## Key Files

| File | Purpose |
|------|---------|
| `app/partner/repost/[handle]/page.tsx` | Server page: lookup, session, social proof |
| `app/partner/repost/[handle]/_components/` | 10 client components |
| `app/api/partner/repost/submit/route.ts` | Submit + post-submit chain |
| `lib/partner/repost-kit/session.ts` | Session creation |
| `lib/partner/repost-kit/projected-commission.ts` | Commission projection |
| `lib/partner/repost-kit/tracker.ts` | Client-side event tracker |

## Systemes connexes

- **Match Engine** (`/admin/match-engine`) — `video_assignment_log.posted_at` is the `first_post_rate` KPI. The match engine's saturation check (`lib/admin/match-engine/saturation-check.ts`) counts assignments per video; `posted_at` non-null signals a successful posting.
- **CRM** (`docs/admin-crm.md`) — Post submit advances influencer status to `onboarded` (guarded: only from `replied`/`interested`/`demo_sent`/`evaluating`). The `last_active_at` timestamp is always updated.
- **Affiliates** — The promo code displayed (`VIRAL-{CODE}`) maps to `influencers.affiliate_code`. Click/signup/conversion tracking happens via the standard affiliate system (`lib/admin/affiliate-attribution.ts`).
- **Video Library** (`/admin/video-library`) — Promo videos referenced by `repost_kit_sessions.promo_video_id` are managed in the video library (`promo_videos` table).
- **Offer Generator** (`/admin/offer-generator`) — The `generated_offers` row for this influencer is updated to status `posted` on submit, closing the offer lifecycle.
- **Discord** — Repost notifications go to the `conversions` channel via `lib/discord/post.ts`.
