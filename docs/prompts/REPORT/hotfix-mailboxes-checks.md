# DoD Report — Hotfix mailboxes CHECK constraints

## Task
sync-instantly cron broken since 2026-09-15 19:00 UTC. cold-email-v2 story S4 writes `provider='google'` (DFY boxes) and `status='reception_only'` (Zoho), both rejected by CHECK constraints on `public.mailboxes`.

## Status: DONE (sync verification pending next cron run)

## Changes

### 1. Migration (applied + verified)
- **File**: `supabase/migrations/20260916120000_mailboxes_checks_v2.sql`
- **Action**: DROP + recreate `mailboxes_provider_check` (added `'google'`) and `mailboxes_status_check` (added `'reception_only'`)
- **Proof**: pg_constraint query confirms both constraints now include the new values

```sql
-- BEFORE
CHECK (provider IN ('zoho','maildoso','gmail','outlook365','other'))
CHECK (status IN ('warming','active','paused','blocked','rate_limited','retired'))

-- AFTER
CHECK (provider IN ('zoho','maildoso','gmail','google','outlook365','other'))
CHECK (status IN ('warming','active','paused','blocked','rate_limited','retired','reception_only'))
```

### 2. Sync verification
- Migration applied in prod BEFORE code push
- CRON_SECRET in .env.local doesn't match Netlify (expected — different envs)
- Next automatic cron run (~13:30 UTC) will be the first sync with constraints fixed
- **Action for Samy**: verify after next cron run with:
  ```sql
  SELECT email, provider, status, daily_send_limit, instantly_account_id IS NOT NULL, warmup_score, updated_at
  FROM mailboxes ORDER BY domain, email;
  ```
  Expected: 12 Zoho → `status='reception_only'`, `daily_send_limit=0`; 8 DFY → `provider='google'`, `daily_send_limit=12`, `instantly_account_id` filled, `warmup_score` non-null

### 3. Watchdog fix
- **File**: `lib/admin/mailbox/health-checker.ts`
- Sync-stale alerts aggregated: one alert "N mailboxes sync stale" instead of 20 individual per-mailbox alerts
- State-change detection: alerts fire only on transitions (healthy→stale, stale→healthy), persisted via `sync_log` table key `watchdog_mailbox_stale`
- Recovery alert (info severity) when all mailboxes return to normal
- Per-mailbox alerts (reputation, bounce, daily limit) unchanged — still individual

### 4. Lessons learned
- **`.claude/skills/migration/SKILL.md`**: added rule — any new value for a CHECK-constrained column requires `pg_constraint` query + constraint extension in migration
- **`docs/prd/README.md`**: added rule #6 — verify for DB-writing stories = SQL query on data, never grep alone

### 5. Decision log
- `docs/wiki/decisions/2026-09.md`: entry for 2026-09-16 hotfix

## Typecheck
```
npx tsc --noEmit → 0 errors
```

## Files changed
- `supabase/migrations/20260916120000_mailboxes_checks_v2.sql` (new)
- `lib/admin/mailbox/health-checker.ts` (aggregated stale alerts + state-change)
- `lib/admin/watchdog/checks.ts` (HOURLY_ALERT_CATEGORIES export)
- `.claude/skills/migration/SKILL.md` (CHECK constraint lesson)
- `docs/prd/README.md` (rule #6)
- `docs/wiki/decisions/2026-09.md` (decision entry)
- `docs/prompts/REPORT/hotfix-mailboxes-checks.md` (this report)
