# Acquisition — Offer Generator + Cold Email Campaigns + Reply Inbox

## What It Does

End-to-end cold outreach pipeline: generate personalized offers from templates, export to Instantly.ai for sending, ingest replies via webhooks, manage conversations in a Gmail-like inbox.

Pipeline: **Offer templates → bulk generate → push to Instantly → webhook ingestion (sent/replied/bounced) → inbox → reply composer**

## Current State: BUILT BUT NEVER USED

- 0 mailboxes configured (Instantly sync runs but returns empty)
- 0 campaigns created
- 0 offers generated (5 seed templates exist but never used)
- 0 emails sent or received
- 0 webhook events ingested
- The entire UI renders, all routes respond, all tables exist — but the pipeline has never run end-to-end

## Architecture

### UI Pages
- `/admin/offer-generator` — Template management, bulk generate, preview (3 tabs)
- `/admin/campaigns` — Campaign list + status
- `/admin/campaigns/new` — 3-step campaign creation wizard
- `/admin/campaigns/[id]` — Campaign detail + recipients + exports
- `/admin/inbox` — Gmail-like 2-column layout (thread list + detail + influencer context sidebar)
- `/admin/mailboxes` — Mailbox list + health status
- `/admin/mailboxes/[id]` — Mailbox detail (Overview / Charts / Daily Stats / Domain tabs)
- `/admin/sync` — Instantly sync status page

### Code — Offer Generator
- `lib/admin/offer-generator/template-renderer.ts` — {{var}} substitution engine (13 variables)
- `lib/admin/offer-generator/variable-extractor.ts` — Extract variables per influencer
- `lib/admin/offer-generator/subject-picker.ts` — Round-robin A/B subject line selection
- `lib/admin/offer-generator/compliance-preflight.ts` — validateContact() before generation
- `lib/admin/offer-generator/repost-kit-url-builder.ts` — Build `/partner/repost/[handle]` URL
- `lib/admin/offer-generator/instantly-pusher.ts` — Push drafts to Instantly API

### Code — Email Campaigns
- `lib/admin/campaigns/csv-generator.ts` — CSV generation + unsubscribe tokens
- `lib/admin/email/` — Email utilities

### Code — Inbox
- `app/(dashboard)/admin/inbox/_components/thread-list.tsx` — Sorted threads
- `app/(dashboard)/admin/inbox/_components/thread-detail.tsx` — Message timeline
- `app/(dashboard)/admin/inbox/_components/reply-composer.tsx` — Send replies via Instantly
- `app/(dashboard)/admin/inbox/_components/influencer-context-sidebar.tsx` — Lead context

### Code — Instantly Integration
- `lib/integrations/instantly/client.ts` — Instantly API v2 wrapper
- `lib/integrations/instantly/sync.ts` — Main orchestrator (every 15 min cron)
- `lib/integrations/instantly/sync-mailboxes.ts` — Mailbox upsert from Instantly
- `lib/integrations/instantly/sync-campaigns.ts` — Campaign analytics from Instantly
- `app/api/admin/webhooks/instantly/route.ts` — Webhook endpoint (idempotent via webhook_events table)
- `lib/admin/webhooks/instantly-processor.ts` — 4 event processors (sent/replied/bounced/unsubscribed)

### Code — Mailbox Health
- `lib/admin/mailbox/health-checker.ts` — 7 health checks (reputation, bounce rate, sync, limits)
- `lib/admin/mailbox/instantly-actions.ts` — Pause/resume mailbox actions

### API Routes
- `POST /api/admin/offer-generator/generate` — Bulk generate offers
- `POST /api/admin/offer-generator/send` — Push to Instantly
- `POST /api/admin/campaigns` — Create campaign draft
- `POST /api/admin/campaigns/[id]/export` — CSV export with suppression check
- `GET /api/admin/inbox` — Thread list with filters
- `POST /api/admin/inbox/reply` — Send reply via Instantly API
- `GET /api/admin/inbox/mailboxes` — Active mailboxes for composer
- `POST /api/admin/webhooks/instantly` — Webhook ingestion (idempotent)
- `POST /api/cron/sync-instantly` — Sync cron (every 15 min)

### Database Tables
- `offer_templates` — 5 seed templates with A/B subject variants
- `generated_offers` — Rendered offers (draft → queued → sent → opened → replied → posted)
- `email_campaigns` — Campaign metadata + aggregated metrics
- `campaign_recipients` — Which leads in which campaigns
- `email_messages` — Sent/received emails (direction, subject, body, read/starred/archived)
- `email_events` — Granular events (sent/replied/bounced/unsubscribed)
- `mailboxes` — Sender accounts (synced from Instantly)
- `mailbox_daily_stats` — Daily health metrics per mailbox
- `webhook_events` — Idempotency layer (UNIQUE provider + event_id)
- `unsubscribe_tokens` — URL-safe tokens for public unsubscribe page

## Known Bugs & Limitations

### 1. Reply Threading Uncertain
Code mentions `in_reply_to`, `message_id_external`, `thread_id` but not verified if Instantly returns these. Replies may not thread correctly in the inbox.

### 2. AI Features Exist But Never Run
- `lib/admin/ai/reply-classifier.ts` — Sentiment classification (fallback: "neutral" for all)
- `lib/admin/ai/reply-drafter.ts` — AI reply drafts (never invoked)
- Both cost ~$0.001-0.003 per email via Claude Haiku

### 3. Unsubscribe Token TTL Not Enforced
Tokens expire after 1 year per code comment but no cleanup cron exists.

### 4. VA Role Not Implemented
Comment in reference doc: "body sera tronque a 200 chars pour role='va'" — but `admin_users` role system never created. VAs can see full email body.

### 5. Campaign CSV Storage Bucket Unverified
`campaign-exports` bucket referenced but not confirmed in Supabase Storage.

## Dependencies
- **Instantly.ai API v2** — INSTANTLY_API_KEY (REQUIRED for all send/sync operations)
- **Claude Haiku** — ANTHROPIC_API_KEY (for AI sentiment + drafts, currently unused)
- **Supabase** — 10 tables, service role for admin operations
- **CRON_SECRET** — For sync-instantly cron endpoint
