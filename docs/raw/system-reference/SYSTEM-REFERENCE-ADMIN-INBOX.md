# SYSTEM REFERENCE — Admin Inbox & Webhook Ingestion (v2)

> Source de verite pour le webhook ingestion Instantly + inbox unifie + anti-downgrade guards.
> Derniere mise a jour : 2026-07-02.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/api/admin/webhooks/instantly/route.ts` | POST endpoint — token auth + rate limit + idempotent insert + process |
| `lib/admin/webhooks/instantly-processor.ts` | Process 4 events with anti-downgrade guards |
| `lib/admin/webhooks/process-event.ts` | Factory — route vers le bon processor selon le provider |
| `app/api/admin/inbox/route.ts` | GET threads + PATCH actions (mark read/star/archive/hot) |
| `app/api/admin/inbox/[influencerId]/route.ts` | GET messages d'un thread (par influencer) |
| `app/api/admin/inbox/reply/route.ts` | POST — send reply via Instantly |
| `app/api/admin/inbox/mailboxes/route.ts` | GET — list active mailboxes for composer |
| `app/api/admin/webhooks/health/route.ts` | GET list + POST retry failed |
| `app/(dashboard)/admin/inbox/page.tsx` | Page inbox — layout 2 colonnes Gmail-like |
| `app/(dashboard)/admin/webhooks/page.tsx` | Health monitor — stats, table, retry |

---

## Webhook Security

### Token Authentication
- Env var: `INSTANTLY_WEBHOOK_SECRET`
- URL to configure in Instantly: `https://viralanimal.com/api/admin/webhooks/instantly?token=YOUR_SECRET`
- Verified via `crypto.timingSafeEqual` (timing-safe comparison)
- If `INSTANTLY_WEBHOOK_SECRET` not set: accepts all requests with console warning (dev mode only — TODO-LAUNCH)

### Rate Limiting
- Uses `RATE_LIMITS.webhook` (100 req/min per IP)
- Returns 429 if exceeded

### Idempotency
- UNIQUE constraint on `(provider, event_id)` in `webhook_events`
- ON CONFLICT DO NOTHING → returns `{ ok: true, duplicate: true }`

---

## Anti-Downgrade Status Rules

Protected statuses that must NEVER be overwritten by automated webhook events:
`interested`, `demo_sent`, `evaluating`, `onboarded`, `active`, `paying`, `declined`, `blocked`

### Status Transition Matrix

| Event | Status change | Allowed FROM | Always happens |
|-------|---------------|--------------|----------------|
| `email_sent` | → `contacted` | `cold`, `queued` | email_events INSERT, total_emails_sent++, last_contacted_at |
| `email_replied` | → `replied` | `unqualified`, `cold`, `queued`, `contacted`, `opened` | email_messages INSERT, email_events INSERT, total_emails_replied++, last_active_at |
| `email_bounced` | → `blocked` | `unqualified`, `cold`, `queued`, `contacted`, `opened`, `replied` | email_events INSERT, suppression_list UPSERT (UNCONDITIONAL) |
| `email_unsubscribed` | → `declined` | `unqualified`, `cold`, `queued`, `contacted`, `opened`, `replied` | email_events INSERT, suppression_list UPSERT (UNCONDITIONAL), unsubscribed=true |

**Key rules:**
- Events (email_events, email_messages) are ALWAYS inserted — the timeline must keep everything
- Counters (total_emails_sent, total_emails_replied, last_active_at) are ALWAYS updated
- Suppression (bounce, unsub) is ALWAYS applied — compliance is unconditional
- Status changes are CONDITIONAL on current status being in the allowed set
- A paying partner whose email bounces stays `paying` in the CRM but gets suppressed (no more sends)

---

## Engagement Fields

The following columns on `influencers` are NOT yet created (pending cockpit CRM migration):
- `has_replied`, `has_bounced`, `has_unsubscribed`
- `last_replied_at`, `last_sent_at`

When these columns exist, each handler should update them:
- email_replied → `has_replied=true`, `last_replied_at=now()`
- email_sent → `last_sent_at=now()`
- email_bounced → `has_bounced=true`
- email_unsubscribed → `has_unsubscribed=true`

---

## Database Tables

| Table | Role |
|---|---|
| `webhook_events` | Idempotency layer — UNIQUE(provider, event_id) |
| `email_messages` | Every email sent/received — direction, subject, body, read/starred/archived |
| `email_events` | Granular events — sent/replied/bounced/unsubscribed with webhook_event_id |
| `influencers` | CRM core — status pipeline, counters, suppression flags |
| `suppression_list` | Auto-suppression on hard bounce + unsubscribe (unconditional) |

---

## Webhook Endpoint Flow

```
POST /api/admin/webhooks/instantly?token=XXX
    |
    v
1. Verify token (timingSafeEqual) → 401 if invalid
2. Rate limit (100/min per IP) → 429 if exceeded
3. Parse payload
4. Compute event_id + payload_hash
5. INSERT INTO webhook_events (idempotent)
    |
    |-- Duplicate? → return { ok: true, duplicate: true }
    |
    v
6. Process event (anti-downgrade guards applied)
    |
    |-- Success → processing_status = 'completed'
    |-- Failure → processing_status = 'failed', error saved
    |
    v
7. return { ok: true }
```

---

## Inbox UI

### Layout
```
+--------------------------------------------+
| Header: Inbox [unread badge]               |
+------------------+-------------------------+
| Thread List 40%  | Thread Detail 60%       |
|                  |                         |
| [Filters]        | [Actions bar]           |
| [Search]         | [Messages timeline]     |
| [Thread 1] *     | [Context sidebar 264px] |
| [Thread 2]       |                         |
| [Thread 3]       | [Reply Composer]        |
+------------------+-------------------------+
```

---

## Reply Composer

Send replies via Instantly API v2. Compliance checks:
- Suppression list checked before every send (403 if suppressed)
- Unsubscribed influencer blocks sending (403)
- Mailbox must be `active` or `warming`
- Template vars interpolated server-side only

---

## Systemes Connexes

### Events → email_events (CAMPAIGNS)
- Every webhook event creates an `email_events` row
- Campaign analytics (`email_campaigns.total_sent`, `total_replies`) derive from these
- `campaign_recipients` tracks which leads are in which campaigns

### Statuts → influencers (CRM)
- Status transitions respect the anti-downgrade matrix above
- `ai_affiliate_score`, `ai_recommendation` from AI Scoring are unaffected by webhook events
- Cockpit CRM dashboard reads status + counters directly from `influencers`

### Suppression → compliance (COMPLIANCE)
- Bounce and unsubscribe add to `suppression_list` UNCONDITIONALLY
- All send operations (offer generator, reply composer, campaign export) check suppression before sending
- `compliance_audit_log` tracks suppression additions

### Mailboxes → mailbox health (MAILBOX-HEALTH)
- Reply composer reads active mailboxes from `mailboxes` table
- Bounces affect mailbox reputation (tracked in `mailbox_daily_stats`)
- Health checker runs 7 checks including bounce rate

---

## Instantly Webhook Config

URL: `https://viralanimal.com/api/admin/webhooks/instantly?token=YOUR_INSTANTLY_WEBHOOK_SECRET`
Events to enable: `email_sent`, `email_replied`, `email_bounced`, `email_unsubscribed`
Env var: `INSTANTLY_WEBHOOK_SECRET` (set in `.env.local`, same value as the `?token=` parameter)

---

*Document version 2.0 — Juillet 2026*
