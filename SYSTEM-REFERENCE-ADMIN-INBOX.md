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
| [Thread 3]       | [Reply Composer]        |
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
- Reply composer (see "Reply Composer" section below)
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

## Reply Composer (Semaine 2)

### Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/admin/inbox/_components/reply-composer.tsx` | UI composer — textarea, from/to, subject, send button |
| `app/(dashboard)/admin/inbox/_components/quick-reply-templates.tsx` | 4 quick-reply presets (1-click) |
| `app/api/admin/inbox/reply/route.ts` | POST — auth, template vars, send via Instantly, INSERT email_messages |
| `app/api/admin/inbox/mailboxes/route.ts` | GET — list active/warming mailboxes for composer dropdown |
| `lib/admin/email/instantly-send.ts` | Instantly API v2 send client |
| `lib/admin/email/template-vars.ts` | Server-side {{var}} interpolation |

### Send Flow

```
User clicks "Send" in composer
    |
    v
POST /api/admin/inbox/reply
    |
    v
1. Auth check (withAdmin)
2. Validate body (Zod)
3. Fetch influencer from DB
4. Check suppression_list (BLOCK if suppressed)
5. Check influencer.unsubscribed (BLOCK if true)
6. Interpolate {{template_vars}} server-side
7. Lookup in_reply_to message for threading (message_id_external, thread_id)
8. Verify mailbox exists + active/warming
9. Send via Instantly API v2 (POST /api/v2/emails/send)
10. INSERT email_messages (direction='outbound', sent_at=now)
11. UPDATE influencers (total_emails_sent++, last_contacted_at)
12. Return { sent: true, messageId }
```

### Compliance Checks
- **Suppression list**: Checked before every send — blocked emails return 403
- **Unsubscribed**: Influencer `unsubscribed=true` blocks sending
- **Mailbox validation**: Must be `active` or `warming` status
- **Template vars server-side only**: Never interpolated client-side

### Template Variables

| Variable | Source |
|---|---|
| `{{first_name}}` | influencer.first_name or display_name |
| `{{last_name}}` | influencer.last_name |
| `{{full_name}}` | first + last name |
| `{{email}}` | influencer.email |
| `{{handle}}` | influencer.platform_handle |
| `{{platform}}` | influencer.primary_platform |
| `{{niche}}` | influencer.niche |
| `{{audience_size}}` | influencer.audience_size |
| `{{affiliate_code}}` | influencer.affiliate_code |
| `{{signup_link}}` | https://viralanimal.com/signup |
| `{{calendly}}` | https://calendly.com/viralanimal/demo |
| `{{link}}` | https://viralanimal.com |
| `{{company}}` | Viral Animal |

### Quick Reply Templates (presets)

| Label | Description |
|---|---|
| Quick yes | Signup link + CTA |
| Schedule a call | Calendly link |
| Soft pitch | No pressure + link |
| Decline politely | Thanks + goodbye |

Templates are hardcoded in `quick-reply-templates.tsx`. Future: editable via `/admin/templates` (Vague 2+).

### Composer UI

```
+──────────────────────────────────────+
| From: [mailbox dropdown]  To: email  |
| Subject: Re: [last subject]         |
| [Quick yes] [Schedule] [Soft] [Dec] |
| ┌──────────────────────────────────┐ |
| │ Write your reply...              │ |
| │                                  │ |
| └──────────────────────────────────┘ |
| Template vars (show/hide)   [Send]   |
+──────────────────────────────────────+
```

### Email Provider

Using **Instantly API v2** (`POST /api/v2/emails/send`).
- Env var: `INSTANTLY_API_KEY`
- Zero new npm dependency
- Preserves sender reputation (sent through warmed mailbox)
- Fallback: Resend planned if Instantly limits hit

### Error Handling

| Scenario | Behavior |
|---|---|
| Email sent but DB insert fails | Returns HTTP 207 (partial), logs error |
| Instantly API down | Returns 502 with error message |
| Suppressed email | Returns 403 |
| Unsubscribed influencer | Returns 403 |
| No active mailbox | UI shows warning, send button disabled |

---

## Semaine 2+ TODO (remaining)

- [x] Reply composer dans inbox (send via Instantly API)
- [ ] Body truncation via v_email_messages_safe view pour VAs
- [ ] AI classification (Claude Haiku) des replies
- [ ] Stripe webhook handler (via process-event.ts factory)
- [ ] Campaign push vers Instantly API
- [ ] Webhook signature verification (HMAC)
- [ ] Editable quick-reply templates via /admin/templates

---

*Document version 1.1 — Mai 2026*
*Branches: feature/admin-inbox, feature/admin-reply-composer*
