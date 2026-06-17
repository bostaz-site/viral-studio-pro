# Railway Audit Cron — Setup Guide

The nightly audit system runs on a **dedicated Railway Cron Job** service, separate from the FFmpeg VPS (`bostaz-site-production`).

## Architecture

```
6am UTC (2am EST)  — Railway Cron Job runs scripts/audits/run-nightly.ts
                     → Runs system agents + persona bots
                     → Inserts findings into Supabase
                     → Generates morning brief
                     → Triggers /api/admin/audits/trigger

7am UTC (3am EST)  — Netlify Scheduled Function (fallback)
                     → Calls /api/admin/audits/trigger?mode=brief
                     → Regenerates brief if Railway missed
```

## Create the Railway Service

1. Go to [railway.app](https://railway.app) → your project
2. Click **"+ New"** → **"Cron Job"**
3. Connect to the **same GitHub repo** (`viral-studio-pro`)
4. Set the cron schedule: `0 6 * * *` (6am UTC = 2am EST)
5. Railway will use `railway.json` at the root for build/deploy config

## Environment Variables

Add these in the Railway service settings → **Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for agent analysis |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://viralanimal.com` |
| `AUDIT_CRON_SECRET` | Yes | Shared secret for /api/admin/audits/trigger |
| `DISCORD_AUDIT_WEBHOOK_URL` | No | Discord webhook for critical finding alerts |
| `RESEND_API_KEY` | No | Resend API key for email morning brief |

## How It Works

The `railway.json` config tells Railway to:
1. **Build**: `npm install && npx playwright install chromium --with-deps` (~300MB for Chromium)
2. **Run**: `npx tsx scripts/audits/run-nightly.ts`
3. **Restart policy**: `NEVER` (it's a one-shot cron, not a long-running server)

The script runs all scheduled agents for the day, generates the morning brief, then exits.

## Viewing Logs

1. Go to Railway dashboard → your audit cron service
2. Click **"Deployments"** → latest deployment
3. Click **"Logs"** to see the full output

The script outputs structured logs:
```
============================================================
[2026-06-17T06:00:01.234Z] Nightly audit START
  Day: Mardi (2)
============================================================

--- output-quality ---
[nightly] Running output-quality...
[nightly] output-quality done (12.3s)

--- activation ---
[nightly] Running runActivationAudit...
[nightly] runActivationAudit done (8.1s)

--- sceptical-first-timer ---
[nightly] Running runScepticalPersona...
[sceptical] Done — 3 findings, score: 7/10
[nightly] runScepticalPersona done (15.2s)

--- Morning brief ---
[nightly] Morning brief generated

============================================================
[2026-06-17T06:00:45.678Z] Nightly audit COMPLETE
  Duration: 44.4s
  Agents run: 3
  Agents failed: 0
  Brief saved: yes
============================================================
```

## Manual Trigger

To run the audit manually (for testing):

1. Railway dashboard → your audit cron service
2. Click **"Trigger"** (or **"Restart"**) to run immediately
3. Check logs for output

Or locally:
```bash
npx tsx scripts/audits/run-nightly.ts
```

## Cost

Railway charges by compute time. A typical nightly run:
- Duration: 1-3 minutes
- Cost: ~$0.01-0.03 per run
- Monthly: ~$0.30-0.90

Chromium adds ~300MB to the build image but doesn't affect runtime cost.

## Fallback

If Railway is down or the cron misses, the Netlify Scheduled Function (`netlify/functions/nightly-audit.mts`) runs 1h later at 7am UTC. It calls `/api/admin/audits/trigger?mode=brief` to generate the morning brief from whatever findings already exist in the DB.
