# Automation Status Report — 2026-08-20

## Executive Summary

- **Crons via cron-job.org**: 3 alive, 11 dead or never configured
- **Audit agents (nightly)**: Dead since July 16 — local daemon not running
- **Lab agent**: Dead since July 19 — crashed on git lock file
- **Morning brief**: Never generated (0 entries)

---

## 1. Crons (app/api/cron/*)

| Cron | Route | State | Last Evidence | Action to Revive |
|------|-------|-------|---------------|------------------|
| **Fetch Twitch clips** | `fetch-twitch-clips` | **ALIVE** | Clips imported today (Aug 20, 18:55 UTC) | None |
| **Publish scheduled** | `publish-scheduled` | **ALIVE** | Last autofarm publish Aug 19 22:00 UTC, 19 published total | None |
| **Rescore clips** | `rescore-clips` | **SICK** | 510 clips overdue for re-check right now, but next_check_at values are recent (Aug 20-21), so it ran recently but can't keep up with 18K clips | Consider increasing frequency or batch size |
| **Refresh post stats** | `refresh-post-stats` | **UNKNOWN** | ai_calls has 474 entries (last Aug 20) but no way to distinguish which are from this cron vs other features | Verify in cron-job.org logs |
| **Refresh OAuth tokens** | `refresh-oauth-tokens` | **NEVER LAUNCHED** | Route created today — no cron job configured yet | Create cron-job.org job: POST every 6h, x-api-key = CRON_SECRET |
| **Cleanup render jobs** | `cleanup-render-jobs` | **UNKNOWN** | 259 expired render jobs exist but unclear if cron cleaned them or they expired naturally | Verify in cron-job.org |
| **Reconcile render** | `reconcile-render` | **UNKNOWN** | No direct trace in DB | Verify in cron-job.org |
| **Cleanup storage** | `cleanup-storage` | **UNKNOWN** | No direct trace in DB | Verify in cron-job.org |
| **Reset usage** | `reset-usage` | **PROBABLY ALIVE** | avg monthly_videos_used = 1.67 (low, consistent with resets happening). But no log to confirm. | Verify in cron-job.org |
| **AI triage** | `ai-triage` | **DEAD** | Depends on audit_findings, which stopped July 16 | Will revive when audits restart |
| **AI scoring** | `ai-scoring` | **NEVER RAN** | 0 entries in ai_calls with feature='lead_scoring' | Needs ANTHROPIC_API_KEY + cron-job.org job |
| **Watchdog** | `watchdog` | **NEVER RAN** | 0 entries in ai_calls with feature='watchdog' | Needs ANTHROPIC_API_KEY + cron-job.org job |
| **Monthly payouts** | `monthly-payouts` | **UNKNOWN** | No affiliate payouts yet (expected — no affiliates earning yet) | Will activate when affiliates earn commissions |
| **Sync Instantly** | `sync-instantly` | **UNKNOWN** | No direct trace | Verify in cron-job.org — needs N8N_API_KEY |

---

## 2. Audit Agents (scripts/audits/run-nightly.ts)

| Agent | Last Finding | Total Findings | State |
|-------|-------------|----------------|-------|
| **activation** | Jul 16, 06:05 | 226 | DEAD 35 days |
| **acquisition** | Jul 16, 06:04 | 135 | DEAD 35 days |
| **retention** | Jul 16, 06:03 | 35 | DEAD 35 days |
| **technical** | Jul 15, 06:04 | 22 | DEAD 36 days |
| **cold_email** | Jul 10, 06:03 | 10 | DEAD 41 days |
| **output** | Jul 8, 06:03 | 174 | DEAD 43 days |
| **pr_review** | Jul 3, 06:17 | 8 | DEAD 48 days |
| **morning_brief** | — | 0 | **NEVER GENERATED** |
| **strategist** | Jul 14 (strategic_moves) | 55 moves | DEAD 37 days |
| **revenue** | — | — | DEAD (no distinct trace) |
| **meta-agent** | Jul 12 (meta_agent_reports) | 11 reports | DEAD 39 days |
| **ai-scout** | Jul 14 (ai_multiplier_opportunities) | 20 | DEAD 37 days |

### How to revive

The nightly runner is a **local script** (`npx tsx scripts/audits/run-nightly.ts`), not a cron-job.org route. It must run on a machine with:

1. `.env.local` with `ANTHROPIC_API_KEY` (or Claude CLI via Max subscription)
2. Network access to Supabase

**Options to relaunch:**

- **Windows Task Scheduler** (Samy's dev machine "Shaggy"): create a task that runs daily at ~6:00 UTC:
  ```
  cd "C:\Users\samyc\Projects\Clips Project" && npx tsx scripts/audits/run-nightly.ts
  ```
- **Or** convert to a cron-job.org HTTP trigger by wrapping in an API route (bigger refactor)

---

## 3. Lab Agent (scripts/lab/lab-agent.ts)

| Field | Value |
|-------|-------|
| **Status** | `offline` |
| **Last heartbeat** | Jul 19, 02:23 UTC (32 days ago) |
| **Total executions** | 3 |
| **Last error** | `git pull origin master exited 128: fatal: update_ref failed for ref 'ORIG_HEAD': cannot lock ref 'ORIG_HEAD': Unable to create '.git/ORIG_HEAD.lock': File exists` |
| **Error date** | Jul 19, 02:23 UTC |
| **Last dive processed** | `landing-pages` (completed, user_action: "later") |
| **Hostname** | Shaggy |

### Root cause

The daemon crashed because a stale `.git/ORIG_HEAD.lock` file blocked `git pull`. The daemon doesn't auto-restart after git errors.

### How to revive

1. Delete the stale lock (if it still exists):
   ```
   del "C:\Users\samyc\Projects\Clips Project\.git\ORIG_HEAD.lock"
   ```
2. Restart the daemon:
   ```
   cd "C:\Users\samyc\Projects\Clips Project"
   npx tsx scripts/lab/lab-agent.ts
   ```
3. Verify heartbeat updates in `lab_agent_status` within 30 seconds
4. Consider making the daemon auto-delete stale lock files on git errors

---

## 4. Related Systems

| System | State | Last Activity | Notes |
|--------|-------|---------------|-------|
| **Autofarm (publish-scheduled)** | ALIVE | Aug 19, 22:00 | 19 published, 257 canceled (clips already published manually), 4 failed |
| **Stripe webhooks** | ALIVE | Aug 19, 22:15 | 4 events processed |
| **Improvement backlog** | STALE | Aug 10 | 145 items — last entry 10 days ago, stops when strategist stops |
| **AI multiplier opportunities** | DEAD | Jul 14 | 20 items — stops when AI scout stops |
| **Render pipeline** | ALIVE | Aug 20, 11:58 | 52 done, 57 errors, 259 expired |

---

## Priority Actions

1. **High — Revive audit nightly**: Set up Windows Task Scheduler or manually run `npx tsx scripts/audits/run-nightly.ts` to verify it still works, then automate
2. **High — Revive Lab agent**: Delete `.git/ORIG_HEAD.lock`, restart daemon
3. **Medium — Create refresh-oauth-tokens cron**: POST every 6h on cron-job.org (route exists, job not created)
4. **Medium — Verify cron-job.org dashboard**: Confirm which of the "UNKNOWN" crons are actually configured vs missing
5. **Low — Configure watchdog + ai-scoring crons**: Need ANTHROPIC_API_KEY in Netlify env + cron-job.org jobs
