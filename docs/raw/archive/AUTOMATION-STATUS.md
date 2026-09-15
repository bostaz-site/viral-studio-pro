# Automation Status — 2026-08-20 (post-fix)

## What was fixed in this commit

| System | Root cause of death | Fix applied |
|--------|-------------------|-------------|
| **Nightly audits** | Local script (`run-nightly.ts`) was run manually, then forgotten. No scheduler, no silence alerting — 35 days of silence with zero notification. | Heartbeat to `lab_agent_status` on every run. Uncaught exception handler + Discord crash alerts. Selective agent config. |
| **Lab agent** | `git pull` hit a stale `.git/ORIG_HEAD.lock` from a crashed process. Error was caught per-dive, but the terminal/machine was likely closed shortly after. No crash notification went out. | `cleanGitLocks()` removes stale lock files (>5 min old) before every git operation. Uncaught exception handler sends Discord alert + logs to DB before dying. |
| **Morning brief** | Never ran — it's called at the end of `run-nightly.ts`, which stopped executing. The function itself works. | Now posts directly to Discord `#morning-brief` channel. |
| **Silence alerting** | Didn't exist. | Watchdog cron now checks `lab_agent_status` heartbeats — if any system is silent >48h, fires a `critical` alert to Discord. |

---

## Current state: what needs manual action from Samy

### 1. Delete stale git lock file (if it still exists)

```powershell
del "C:\Users\samyc\Projects\Clips Project\.git\ORIG_HEAD.lock"
```

### 2. Start the nightly audits (one-time test)

```powershell
cd "C:\Users\samyc\Projects\Clips Project"
npx tsx scripts/audits/run-nightly.ts
```

Watch the output. It should run output-quality, technical, activation, personas, and morning brief. Check Discord for the morning brief message.

### 3. Schedule nightly audits (Windows Task Scheduler)

```powershell
schtasks /create /tn "ViralAnimal-Nightly-Audits" /tr "cmd /c cd /d \"C:\Users\samyc\Projects\Clips Project\" && npx tsx scripts/audits/run-nightly.ts >> C:\Users\samyc\nightly-audit.log 2>&1" /sc daily /st 06:00 /f
```

This runs every day at 6:00 AM local time. Output is appended to `C:\Users\samyc\nightly-audit.log`.

### 4. Start the Lab agent

```powershell
cd "C:\Users\samyc\Projects\Clips Project"
npx tsx scripts/lab/lab-agent.ts
```

For persistent background running, use a dedicated terminal or:
```powershell
start /min cmd /c "cd /d \"C:\Users\samyc\Projects\Clips Project\" && npx tsx scripts/lab/lab-agent.ts >> C:\Users\samyc\lab-agent.log 2>&1"
```

### 5. Create watchdog cron on cron-job.org

The watchdog cron now includes silence detection. If it's not already configured:

- **URL**: `https://viralanimal.com/api/cron/watchdog`
- **Method**: POST
- **Header**: `x-api-key: <CRON_SECRET>`
- **Schedule**: every 15 minutes

### 6. Create refresh-oauth-tokens cron on cron-job.org

- **URL**: `https://viralanimal.com/api/cron/refresh-oauth-tokens`
- **Method**: POST
- **Header**: `x-api-key: <CRON_SECRET>`
- **Schedule**: every 6 hours

---

## Agent configuration

### Active agents (product-focused — run every night)

| Agent | What it checks |
|-------|---------------|
| output-quality | Render output quality, caption accuracy, format compliance |
| technical | Build errors, dead code, performance issues, security |
| activation | Signup → first render conversion, onboarding friction |
| production-errors | Sentry error patterns from the last 24h |
| Personas (1-2 random) | Simulated user journeys (skeptical first-timer, free user at limit, power user) |

### Paused agents (acquisition — not useful until growth machine runs)

To re-enable all acquisition agents, add to `.env.local`:
```
ENABLE_ACQUISITION_AGENTS=true
```

This enables: acquisition, cold-email, retention, ai-scout, ai-multiplier, strategist, revenue-agent, meta-agent, strategic-brief.

---

## Silence monitoring

The watchdog cron (`/api/cron/watchdog`) now checks `lab_agent_status` for:
- `singleton` (Lab agent) — heartbeats every 60s when running
- `nightly-audits` — heartbeats once per execution

If either is silent for >48 hours, a `critical` alert fires to Discord `#critical-alerts`:
> "⚠️ Nightly Audits silent for 3 days — Status: completed. Last error: none"

This ensures 35 days of silence can never happen again.

---

## Cron status summary

| Cron | State | cron-job.org needed |
|------|-------|-------------------|
| fetch-twitch-clips | ALIVE | Already configured |
| publish-scheduled | ALIVE | Already configured |
| rescore-clips | ALIVE | Already configured |
| watchdog | NEEDS SETUP | Every 15 min (now includes silence detection) |
| refresh-oauth-tokens | NEEDS SETUP | Every 6 hours |
| cleanup-render-jobs | VERIFY | Check cron-job.org dashboard |
| reconcile-render | VERIFY | Check cron-job.org dashboard |
| reset-usage | VERIFY | Check cron-job.org dashboard |
| refresh-post-stats | VERIFY | Check cron-job.org dashboard |
| ai-scoring | PAUSED | Needs leads to score |
| sync-instantly | PAUSED | Needs Instantly campaigns |
| monthly-payouts | PAUSED | Needs affiliate earnings |
