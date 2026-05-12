# SYSTEM REFERENCE — Admin Inbox & Webhook Ingestion (v1)

> Source de verite pour le webhook ingestion Instantly + inbox unifie read-only + webhook health monitor.
> Derniere mise a jour : 2026-05-12.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/api/admin/webhooks/instantly/route.ts` | POST endpoint — recoit les webhooks Instantly, idempotent via webhook_events |
| `lib/admin/webhooks/instantly-processor.ts` | Process les 4 events critiques (sent/replied/bounced/unsubscribed) |
| `lib/admin/webhooks/process-event.ts` | Factory — route vers le bon processor selon le provider |
| `app/api/admin/inbox/route.ts` | GET threads + PATCH actions (mark read/star/archive/hot) |
| `app/api/admin/inbox/[influencerId]/route.ts` | GET messages d'un thread (par influencer) |
| `app/api/admin/webhooks/health/route.ts` | GET liste webhooks + POST retry failed |
| `app/api/admin/webhooks/health/[id]/route.ts` | GET detail webhook avec payload complet |
| `app/(dashboard)/admin/inbox/page.tsx` | Page inbox — layout 2 colonnes Gmail-like |
| `app/(dashboard)/admin/inbox/_components/inbox-filters.tsx` | Barre filtres — search + pills (all/unread/starred/archived) |
| `app/(dashboard)/admin/inbox/_components/thread-list.tsx` | Liste threads — sorted by last message, status badge, unread dot |
| `app/(dashboard)/admin/inbox/_components/thread-detail.tsx` | Detail thread — timeline sent+replies, actions, context sidebar |
| `app/(dashboard)/admin/inbox/_components/influencer-context-sidebar.tsx` | Sidebar — status, lead score, tags, platform, audience |
| `app/(dashboard)/admin/webhooks/page.tsx` | Health monitor — stats cards, filtres, table, detail modal |
| `app/(dashboard)/admin/webhooks/_components/webhook-table.tsx` | Table des webhooks avec status icons, retry button |
| `app/(dashboard)/admin/webhooks/[id]/page.tsx` | Page detail webhook — payload JSON, error, retry |

---

## Database Tables

| Table | Role |
|---|---|
| `webhook_events` | Idempotency layer — UNIQUE(provider, event_id), ON CONFLICT DO NOTHING |
| `email_messages` | Chaque email envoye/recu — direction, subject, body, is_read/starred/archived |
| `email_events` | Events granulaires — sent/replied/bounced/unsubscribed avec webhook_event_id |
| `influencers` | CRM core — status pipeline, lead score, tags, email stats |
| `suppression_list` | Auto-suppression sur bounce hard + unsubscribe |

---

## Webhook Endpoint Flow

```
POST /api/admin/webhooks/instantly
    |
    v
1. Parse payload
2. Compute event_id (payload.id || ${event_type}_${timestamp}_${email})
3. Compute payload_hash (sha256)
4. INSERT INTO webhook_events
   ON CONFLICT (provider, event_id) DO NOTHING
    |
    |-- Duplicate? → return { ok: true, duplicate: true }
    |
    v
5. Process event (instantly-processor.ts)
    |
    |-- Success → status = 'completed'
    |-- Failure → status = 'failed', error_message saved
    |
    v
6. return { ok: true }
```

**Anti-pattern**: JAMAIS process l'event AVANT l'INSERT webhook_events.

---

## Event Processors (Semaine 1)

### email_sent
- INSERT `email_events` (type='sent')
- UPDATE `influencers.last_contacted_at`
- Auto-advance: cold/queued → contacted

### email_replied
- INSERT `email_messages` (direction='inbound', is_read=false)
- INSERT `email_events` (type='replied')
- UPDATE `influencers.status` → 'replied'
- INCREMENT `influencers.total_emails_replied`

### email_bounced
- INSERT `email_events` (type='bounced_hard')
- UPSERT `suppression_list` (reason='hard_bounce')
- UPDATE `influencers.status` → 'blocked'

### email_unsubscribed
- INSERT `email_events` (type='unsubscribed')
- UPSERT `suppression_list` (reason='unsubscribe')
- UPDATE `influencers.unsubscribed` = true, status → 'declined'

### Autres events
- Stockes dans `webhook_events` mais pas traites (TODO Semaine 2+)

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
| [Thread 3]       | "Composer Week 2"       |
+------------------+-------------------------+
```

### Thread List
- Sorted by `created_at DESC` du dernier message
- Filtres: All / Unread / Starred / Archived
- Chaque item: nom + email, subject, preview (60 chars), status badge, time ago
- Dot bleu pour unread, etoile pour starred

### Thread Detail
- Messages en timeline chronologique (outbound = bleu, inbound = vert)
- Auto-mark read a l'ouverture
- Actions: Mark hot (tag), Star, Archive
- PAS de composer (Semaine 2)
- Sidebar context: status, lead score, tags, platform, audience, stats

### Body Truncation (VAs)
- Quand roles admin_users seront en place, le body sera tronque a 200 chars pour role='va'
- Actuellement: full body visible (auth email-based = owner only)

---

## Webhook Health Monitor

### Stats
- 3 cards: Total / Completed (vert) / Failed (rouge)

### Table (100 derniers)
- Colonnes: Status icon, Provider, Event Type, Received, Processed, Retries, Actions
- Filtres: status, provider, event_type
- Click row → modal detail avec payload JSON + error

### Retry
- Button retry visible uniquement pour status='failed'
- Re-process via `processWebhookEvent()` factory
- Incremente retry_count

### Detail Page `/admin/webhooks/[id]`
- Vue complete: info grid + error message + payload JSON formatee
- Retry button si failed

---

## API Routes

### GET /api/admin/inbox
Query params: `filter` (all|unread|starred|archived), `search`, `page`
Returns: `{ threads, totalUnread, page, hasMore }`

### PATCH /api/admin/inbox
Body: `{ messageIds: string[], action: 'mark_read'|'mark_unread'|'star'|'unstar'|'archive'|'unarchive'|'mark_hot' }`
- mark_hot: aussi ajoute tag 'hot' sur l'influencer

### GET /api/admin/inbox/[influencerId]
Returns: `{ influencer, messages, events }`
Side effect: auto-mark inbound messages as read

### GET /api/admin/webhooks/health
Query params: `status`, `provider`, `event_type`, `page`
Returns: `{ webhooks, total, page, hasMore, stats }`

### POST /api/admin/webhooks/health
Body: `{ webhookId: string }`
Retry un webhook failed

### GET /api/admin/webhooks/health/[id]
Returns: webhook complet avec payload

---

## Sidebar Navigation

Inbox et Webhooks ajoutes au sidebar admin dans `app/(dashboard)/layout.tsx`:
```typescript
{ name: 'Inbox', href: '/admin/inbox', icon: Inbox }
{ name: 'Webhooks', href: '/admin/webhooks', icon: Webhook }
```

---

## Instantly Webhook Config

URL: `https://viralanimal.com/api/admin/webhooks/instantly`
Events: email_sent, email_replied, email_bounced, email_unsubscribed

---

## Semaine 2 TODO

- [ ] Reply composer dans inbox (send via Resend ou Instantly API)
- [ ] Body truncation via v_email_messages_safe view pour VAs
- [ ] AI classification (Claude Haiku) des replies
- [ ] Stripe webhook handler (via process-event.ts factory)
- [ ] Campaign push vers Instantly API
- [ ] Webhook signature verification (HMAC)

---

*Document version 1.0 — Mai 2026*
*Branch: feature/admin-inbox*
