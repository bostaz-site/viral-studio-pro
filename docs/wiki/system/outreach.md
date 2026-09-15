# Outreach System

Cold email infrastructure: 5-step sequence, reply classification, spike-triggered prioritization, compliance.

## Architecture

Instantly.ai handles sending, warmup, and deliverability. Our system handles: template management, compliance preflight, reply classification, lead enrichment, and metric tracking.

## Key Files

| File | Purpose |
|---|---|
| `lib/schemas/cold-email.ts` | Zod schemas (createSequence, webhook) |
| `lib/integrations/instantly/client.ts` | Instantly v2 API client |
| `lib/integrations/instantly/sync-mailboxes.ts` | Sync mailboxes, warmup guard |
| `lib/integrations/instantly/sync-campaigns.ts` | Sync campaigns, positive reply rate, bounce guard |
| `lib/admin/webhooks/instantly-processor.ts` | Webhook event processor + reply classifier |
| `lib/admin/offer-generator/compliance-preflight.ts` | Sequence-level compliance checks |
| `lib/outreach/spike-trigger.ts` | Streamer spike → lead enrichment |
| `lib/admin/offer-generator/instantly-pusher.ts` | Push leads to Instantly (spike priority) |
| `app/api/admin/campaigns/create-sequence/route.ts` | Create Instantly campaign from templates |
| `app/api/webhooks/instantly/route.ts` | Instantly webhook receiver (dedup, rate limit, zod) |
| `app/api/cron/resequence-leads/route.ts` | Daily cron: not_now → cold after 60d |
| `app/api/admin/inbox/demo-kit/route.ts` | Draft demo kit for interested leads |
| `scripts/check-sequence.ts` | CLI compliance check per sequence |

## Env Vars

| Var | Purpose |
|---|---|
| `INSTANTLY_API_KEY` | Instantly v2 API key |
| `INSTANTLY_WEBHOOK_SECRET` | Webhook token verification |
| `ANTHROPIC_API_KEY` | Reply classification + compliment generation |
| `CRON_SECRET` | Cron route auth |

## Crons

| Cron | Schedule | Purpose |
|---|---|---|
| `sync-instantly` | Every 15 min | Sync mailboxes + campaigns from Instantly |
| `resequence-leads` | Daily | Move not_now leads back to cold after 60 days |
| `rescore-clips` | Every 15 min | Spike detection → spike-trigger enrichment |

## Webhook Flow

1. Instantly sends event to `POST /api/webhooks/instantly?token=SECRET`
2. Route validates token (timingSafeCompare), rate limits, validates body (zod)
3. Inserts into `webhook_events` with dedup (ON CONFLICT)
4. Calls `processInstantlyEvent()`:
   - `email_sent` → update influencer status to contacted
   - `email_replied` → classify via Haiku → set reply_bucket → bucket actions
   - `email_bounced` → suppression list + status blocked
   - `email_unsubscribed` → suppression list + status declined

## Reply Classification

Claude Haiku classifies inbound replies into 7 categories (6 buckets + auto_reply):
- `interested` → autoOnboard pipeline
- `evaluating` → Discord ping for manual reply
- `not_now` → dormant + resequence_after +60d + removed from Instantly
- `wrong_person` → declined + forwarded contacts in notes
- `unsubscribed` → suppression 4-way + Instantly removal
- `negative` → declined
- `auto_reply` → ignored (no bucket)

## Spike Trigger

When `rescore-clips` detects a spike (views > 1.2x last snapshot):
1. Look up streamer's twitch/kick login
2. Find matching influencer by platform_handle
3. If status in (cold, queued) and not suppressed:
   - Tag 'spike', set next_follow_up_at=now()
   - Refresh recent_video_titles from spiking clip
   - Regenerate ai_specific_compliment via Haiku
   - Store demo_clip_url if 3/3 render exists
4. Spike-tagged leads exported first by instantly-pusher

## Compliance

Pre-send checks (`sequenceCompliancePreflight`):
- Step 1: no URL
- All steps: <=80 words (excl. footer)
- Footer: postal address (J1Z 0A6) + {{unsubscribeLink}}
- Banned: "limited time", "exclusive", "act now", 3+ exclamation marks, ALL-CAPS words
- create-sequence returns 422 with violations list on failure

Post-send: bounce rate >1.5% → auto-pause campaign + Discord alert.
