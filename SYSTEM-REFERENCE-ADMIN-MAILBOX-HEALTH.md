# SYSTEM REFERENCE — Admin Mailbox Health Monitoring (v1)

> Source de verite pour le monitoring deliverability, reputation et bounce rates des mailboxes.
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/admin/mailboxes/page.tsx` | Liste mailboxes — table, status filter, reputation gauge, actions |
| `app/(dashboard)/admin/mailboxes/[id]/page.tsx` | Detail — tabs (Overview, Health Charts, Daily Stats, Domain), alerts sidebar |
| `app/(dashboard)/admin/mailboxes/_components/mailbox-table.tsx` | Table component — status badges, progress bars, quick actions |
| `app/(dashboard)/admin/mailboxes/_components/health-chart.tsx` | Recharts line charts — reputation, bounce rate, volume (30d) |
| `app/(dashboard)/admin/mailboxes/_components/reputation-gauge.tsx` | Circular gauge — color-coded 0-100 score |
| `app/(dashboard)/admin/domains/page.tsx` | Domain list — SPF/DKIM/DMARC status, mailbox count, warmup |
| `app/api/admin/mailboxes/route.ts` | GET — list mailboxes with 7-day stats enrichment |
| `app/api/admin/mailboxes/[id]/route.ts` | GET — detail with daily_stats, alerts, domain info |
| `app/api/admin/mailboxes/[id]/sync/route.ts` | POST — force re-sync via Instantly |
| `app/api/admin/mailboxes/[id]/pause/route.ts` | POST — pause mailbox (Instantly API + local status) |
| `app/api/admin/mailboxes/[id]/resume/route.ts` | POST — resume mailbox (Instantly API + local status) |
| `app/api/admin/domains/route.ts` | GET — list domains with mailbox counts |
| `lib/admin/mailbox/health-checker.ts` | 7 health checks integrated into watchdog cron |
| `lib/admin/mailbox/instantly-actions.ts` | Wrapper: pauseEmailAccount, resumeEmailAccount, getAccountWarmupStatus |

---

## Mailbox List Page Layout

```
1. Header — Mail icon + "Mailboxes" + subtitle
2. Stats row — Active | Avg Reputation | Problems | Sent Today
3. MailboxTable:
   ├── Status filter pills (All, Active, Warming, Paused, Blocked)
   ├── Columns: Email, Status, Reputation, Today (progress bar), 7d Bounce%, 7d Reply%, Last Sync
   └── Actions per row: View, Pause/Resume, Force Sync
```

---

## Mailbox Detail Page Layout

```
1. Header — reputation gauge + email + provider + status badge + action buttons
2. Active alerts (red/amber cards if any)
3. Tabs:
   ├── Overview — 4 KPIs (30d Sent/Opened/Replied/Bounced) + bounce/complaint rates + today usage
   ├── Health Charts — 3 Recharts LineCharts (reputation, bounce rate, volume over 30d)
   ├── Daily Stats — sortable table from mailbox_daily_stats
   └── Domain — SPF/DKIM/DMARC status cards + warmup info
```

---

## Watchdog Health Checks (7 conditions)

| # | Condition | Severity | Threshold |
|---|---|---|---|
| 1 | Reputation < 50 | Critical | Score below 50 |
| 2 | Reputation < 70 | Important | Score below 70 |
| 3 | 7-day bounce rate > 5% | Critical | Over 5% bounces |
| 4 | 7-day bounce rate > 3% | Important | Over 3% bounces |
| 5 | Daily limit > 90% used | Important | sent > 0.9 * limit |
| 6 | No sync > 6 hours | Critical | updated_at stale |
| 7 | Reputation drop > 15pts in 24h | Critical | Yesterday vs today in mailbox_daily_stats |

All checks run via `checkMailboxHealth()` integrated into `runAllChecks()` in the watchdog cron.

---

## API Routes

### GET /api/admin/mailboxes
Returns all non-retired mailboxes enriched with 7-day aggregates (week_bounce_rate, week_reply_rate, week_sent).

### GET /api/admin/mailboxes/[id]
Returns: `{ mailbox, daily_stats (30d), alerts (active), domain }`

### POST /api/admin/mailboxes/[id]/pause
Calls Instantly API `POST /accounts/{id}/pause` then updates local status.

### POST /api/admin/mailboxes/[id]/resume
Calls Instantly API `POST /accounts/{id}/resume` then updates local status.

### POST /api/admin/mailboxes/[id]/sync
Triggers full Instantly sync (per-account sync not available in API).

### GET /api/admin/domains
Returns all domains with mailbox_count enrichment.

---

## Database Tables

| Table | Role |
|---|---|
| `mailboxes` | Core — email, domain, provider, status, reputation_score, bounce_rate_pct, daily_send_limit, DNS valid flags |
| `mailbox_daily_stats` | Historical — per mailbox per day: sent, delivered, opened, replied, bounced, complained, reputation_score |
| `domains` | DNS — domain, registrar, SPF/DKIM/DMARC configured, warmup, status, expires_at |
| `agent_alerts` | Watchdog alerts (category='mailbox') |

---

## Instantly Integration

```
Existing: getEmailAccounts(), getCampaigns(), syncInstantlyStats()
New wrappers in lib/admin/mailbox/instantly-actions.ts:
  - pauseEmailAccount(id) → POST /accounts/{id}/pause
  - resumeEmailAccount(id) → POST /accounts/{id}/resume
  - getAccountWarmupStatus(id) → GET /accounts/{id}/warmup
```

---

## Anti-Patterns (DO NOT)

- Spam Instantly API (cache responses, rate limit)
- Create duplicate alerts (watchdog dedupes by title in last 24h)
- Expose credentials client-side (mailboxes.credentials_encrypted hidden via v_mailboxes_safe view)
- Forget to update sidebar (layout.tsx) when adding pages
