# Distribution System

Auto-distribute clips to TikTok/YouTube/Instagram/Facebook with quality gates, cadence control, and diversification.

## Clip Bank
Explicit autofarm queue. Clips enter ONLY by user action ("Place in bank"). Renders are out-of-bank by default (`removed_from_bank_at = now()` at render_job creation). `removed_from_bank_at IS NULL` = in bank. Queries use `.in('status', ['done', 'degraded'])`.

## Autofarm Flow
1. User enables Auto-Distribute toggle
2. Client POST `/api/distribution/autofarm-sync` → insert `scheduled_publications` rows
3. Cron `publish-scheduled` (every 5-10min) picks rows WHERE `status='scheduled' AND scheduled_at <= now()`
4. Optimistic lock → quality gates → execute publish → insert `published_posts` → remove from bank

## Quality Gates (publish-scheduled cron)
Each gate cancels the publication with an explicit reason:
| Gate | Condition | Reason |
|------|-----------|--------|
| Already published | `published_posts` row exists | `already published manually` |
| Autofarm paused | `NOW() < autofarm_paused_until` | `autofarm_paused` |
| Content risk | `content_risk IS NOT NULL` + `allow_risky_content=false` | `content_risk_blocked` |
| Already edited | `edit_signals.source_has_burned_captions + source_is_vertical` | `already_edited` |
| Render degraded | `render_jobs.status = 'degraded'` | `render_degraded` |
| Transform score | `transform_score < 2` | `transform_score_too_low` |
| Analysis criteria | All 4 criteria < 4 | `analysis_criteria_too_low` |

## Cadence Engine
Column: `distribution_settings.cadence_preset` ('warmup'|'growth'|'farm').
- Warmup: 0 first 48h, then 1/day, 3h spacing
- Growth: 1-2/day, 3h spacing
- Farm: 3-4/day, 3h spacing

## Gate Refusal UI
Hub polls `GET /api/distribution/scheduled-status` every 60s. Canceled posts shown with user-friendly messages via `lib/distribution/gate-reasons.ts`. Clip bank shows "Skipped by gate" badge. Countdown skips past/canceled posts.

## Caption Engine (`lib/ai/caption-engine.ts`)
Claude Haiku generates 3 variants per platform. Structure: niche keyword sentence + genuine question + @credit + 1-3 niche hashtags. Banned: generic hashtags (#fyp etc.), hype phrases, engagement bait. Post-filter strips banned phrases.

## Caption Diversification
`lib/distribution/caption-diversifier.ts` — if same clip already published with identical caption, generates a Haiku variant. Seeded by clip+platform+day.

## Published Posts Learning Loop
Every publish inserts `published_posts` with render settings snapshot. Three metadata sources: client → render_settings → trending_clips. Cron `refresh-post-stats` tracks performance.

## Key files
- `app/api/cron/publish-scheduled/route.ts` — autofarm executor with gates
- `app/api/distribution/autofarm-sync/route.ts` — queue sync
- `app/api/distribution/scheduled-status/route.ts` — gate status polling
- `lib/distribution/smart-queue-engine.ts` — client-side queue generation
- `lib/distribution/gate-reasons.ts` — user-friendly gate messages
- `lib/distribution/cadence-engine.ts` — posting frequency
- `lib/distribution/execute-publish.ts` — shared publish logic
- `lib/ai/caption-engine.ts` — AI captions
- `stores/distribution-store.ts` — Zustand state
- `components/distribution/distribution-hub.tsx` — main UI
