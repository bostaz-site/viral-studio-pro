# SYSTEM REFERENCE — Admin Watchdog Agent (v1.1)

> Source de verite pour le watchdog agent qui monitore la sante du systeme admin.
> Derniere mise a jour : 2026-07-02.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/api/cron/watchdog/route.ts` | Cron endpoint (POST, auth via CRON_SECRET) — toutes les 15 min |
| `lib/admin/watchdog/checks.ts` | 10 health checks rule-based (5 critical + 5 important) + 7 mailbox checks via health-checker |
| `lib/admin/watchdog/anomaly-detector.ts` | Claude Haiku weekly anomaly detection |
| `lib/admin/watchdog/notifier.ts` | Email notification via Resend pour alertes critical |
| `app/api/admin/watchdog/route.ts` | GET alerts list + health overview |
| `app/api/admin/watchdog/dismiss/route.ts` | POST dismiss alerts |
| `app/(dashboard)/admin/watchdog/page.tsx` | Dashboard page — tabs, filters, auto-refresh 60s |
| `app/(dashboard)/admin/watchdog/_components/health-overview.tsx` | 4 stats cards (active, critical, important, webhooks status) |
| `app/(dashboard)/admin/watchdog/_components/alerts-table.tsx` | Alert cards avec severity icons, dismiss button |

---

## Database

### `agent_alerts` table
```sql
id UUID PRIMARY KEY
severity TEXT ('critical' | 'important' | 'info')
category TEXT ('webhook' | 'stripe' | 'mailbox' | 'affiliate' | 'crm' | 'compliance' | 'ai_insight' | 'app')
title TEXT
description TEXT
metadata JSONB
detected_at TIMESTAMPTZ
dismissed_at TIMESTAMPTZ
dismissed_by UUID
resolved_at TIMESTAMPTZ
notified BOOLEAN
```

Index: `idx_alerts_active` — active alerts sorted by severity + detected_at.

---

## Cron Flow

```
POST /api/cron/watchdog (every 15 min, x-api-key: CRON_SECRET)
    |
    v
1. Run 10 rule-based checks (Promise.allSettled)
    |
    v
2. Run Claude Haiku anomaly detection (every ~6h only)
    |
    v
3. Dedupe: skip if same title exists in last 24h
    |
    v
4. INSERT new alerts into agent_alerts
    |
    v
5. Email critical alerts via Resend (mark notified=true)
    |
    v
6. Return { checks_run, alerts_found, alerts_deduped, alerts_inserted }
```

---

## Health Checks

### CRITICAL (email immediately)

| # | Check | Condition | Category |
|---|---|---|---|
| 1 | Instantly webhooks down | No webhook_events from instantly in 30 min (business hours only). **Garde** : ne s'active que si >= 1 event instantly dans les 7 derniers jours | webhook |
| 2 | Stripe webhook failures | webhook_events provider=stripe status=failed in last 60 min | stripe |
| 3 | Bounce rate > 5% | email_events bounces / sent > 5% in 24h (min 10 sent) | mailbox |
| 4 | Stripe Connect rejected | influencers with stripe_connect_status=rejected | affiliate |
| 5 | Webhook fail spike | > 10 failed webhook_events in last hour (any provider) | webhook |

### IMPORTANT (digest / dashboard only)

| # | Check | Condition | Category |
|---|---|---|---|
| 1 | Hot leads stale > 4h | influencers status in (replied, interested), last_active_at > 4h ago | crm |
| 2 | Dormant affiliates | influencers status=onboarded, updated_at > 5 days ago | affiliate |
| 3 | Reply rate drop > 50% | Week-over-week reply rate comparison (min 20 sent each week) | mailbox |
| 4 | KYC pending > 7 days | influencers stripe_connect_status=pending_kyc, updated > 7 days ago | affiliate |
| 5 | Suppression spike | > 20 new suppression_list entries in 24h | compliance |

---

## Claude Haiku Anomaly Detection

- Runs every ~6h (when UTC hour % 6 === 0 and minute < 15)
- Compares weekly metrics: sent, replies, bounces, new leads, suppressions
- Returns JSON: `{ hasAnomaly, severity, title, description }`
- Logged via `logAiCall()` to `ai_calls` table
- Cost estimate: < $5/month
- Model: `claude-haiku-4-5-20251001`
- Category: `ai_insight`

---

## Notification

- **Critical alerts** → email via Resend to samycloutier30@gmail.com
- Subject: `[Watchdog] N critical alert(s) detected`
- HTML body with alert details + link to /admin/watchdog
- Fallback: console.warn if RESEND_API_KEY not set
- `notified` flag set to true after email

### Anti-spam
- Dedupe: same title within 24h is skipped (no duplicate alerts)
- All checks run in parallel via Promise.allSettled (one failure doesn't block others)
- AI detection limited to every 6h

---

## Dashboard UI

### Layout
```
Header: "Watchdog" + active count badge
Health Overview: 4 cards (Active | Critical | Important | Webhooks)
Tabs: Active (count) | Dismissed
Severity filter: All | Critical | Important | Info
Alerts list: severity icon + title + category badge + description + dismiss button
Auto-refresh: 60s interval
```

### Severity colors
- Critical: red (XCircle icon)
- Important: amber (AlertTriangle icon)
- Info: blue (Info icon)

### Category badge colors
- webhook: purple
- stripe: indigo
- mailbox: sky
- affiliate: emerald
- crm: green
- compliance: orange
- ai_insight: violet

---

## API Routes

### GET /api/admin/watchdog
Query: `tab` (active|dismissed), `severity`, `page`
Returns: `{ alerts, total, page, hasMore, counts, health }`

### POST /api/admin/watchdog/dismiss
Body: `{ alertIds: string[] }`
Sets dismissed_at + dismissed_by

### POST /api/cron/watchdog
Auth: `x-api-key: CRON_SECRET`
Returns: `{ checks_run, alerts_found, alerts_deduped, alerts_inserted, duration_ms }`

---

## Cron Configuration

Add to external cron service (cron-job.org or GitHub Actions):
```
POST https://viralanimal.com/api/cron/watchdog
Header: x-api-key: <CRON_SECRET>
Schedule: */15 * * * *
```

Listed in `netlify.toml` cron comment block.

---

## Env Vars Required

| Var | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | Yes | Auth for cron endpoint |
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku anomaly detection |
| `RESEND_API_KEY` | Optional | Critical alert emails (falls back to console) |

---

## Mailbox Health Checks (7 additional — via MAILBOX-HEALTH)

Les 7 checks mailbox definis dans `lib/admin/mailbox/health-checker.ts` sont integres dans `runAllChecks()` via `checkMailboxHealth()`. Voir SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md pour le detail des seuils.

---

## Gardes anti-faux-positifs

Les checks qui supposent un systeme actif incluent des gardes :
- **Instantly webhooks down** : exige >= 1 event provider='instantly' dans les 7 derniers jours
- **Bounce rate** : exige min 10 emails envoyes en 24h
- **Reply rate drop** : exige min 20 envoyes par semaine (chaque semaine)
- **Mailbox health** : dormant tant que sync-instantly n'est pas schedule (voir MAILBOX-HEALTH)

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **MAILBOX-HEALTH** | 7 checks mailbox integres dans runAllChecks() |
| **Instantly sync** | Les checks webhook dependent des donnees de sync-instantly |
| **Stripe** | Check Stripe webhook failures + Connect KYC rejected |
| **CRM** | Check hot leads stale + dormant affiliates |
| **COMPLIANCE** | Check suppression list spike |
| **AI** | Anomaly detection Claude Haiku (logged dans ai_calls) |

---

*Document version 1.1 — Juillet 2026*
