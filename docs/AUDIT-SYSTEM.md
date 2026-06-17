# Night Audit System

Automated nightly audit system that runs agents and personas to find issues, track KPIs, and generate a morning brief.

## Architecture

```
2am EST (6am UTC)
    |
    v
Netlify Scheduled Function (nightly-audit.mts)
    |
    v  POST /api/admin/audits/trigger
    |
    v
Orchestrator (scripts/audits/run-nightly.ts)
    |
    +-- Output Quality Agent (daily)
    +-- System Agent (rotates by weekday)
    +-- 1-2 Random Personas
    +-- Morning Brief Generator
         |
         +-- Saves to Supabase Storage
         +-- Sends email via Resend (optional)
         +-- Discord alert for critical findings
```

## Schedule

| Day       | System Agent   | Personas |
|-----------|---------------|----------|
| Monday    | Acquisition   | 2 random |
| Tuesday   | Activation    | 2 random |
| Wednesday | Technical     | 2 random |
| Thursday  | Retention     | 2 random |
| Friday    | Cold Email    | 2 random |
| Saturday  | -             | 1 random |
| Sunday    | -             | 1 random |

Output Quality Agent runs every day.

## Running Manually

```bash
# Full nightly run
npx tsx scripts/audits/run-nightly.ts

# Generate morning brief only
npx tsx -e "import { generateMorningBrief } from './lib/audit/morning-brief'; generateMorningBrief().then(b => console.log(b))"

# Trigger via API (requires AUDIT_CRON_SECRET)
curl -X POST https://viralanimal.com/api/admin/audits/trigger \
  -H "Authorization: Bearer YOUR_AUDIT_CRON_SECRET" \
  -H "Content-Type: application/json"

# Brief only mode
curl -X POST "https://viralanimal.com/api/admin/audits/trigger?mode=brief" \
  -H "Authorization: Bearer YOUR_AUDIT_CRON_SECRET"
```

## Deployment Options

### Option A: Railway VPS (recommended)

Best for: long-running agents with Playwright, no timeout limits.

1. Add to Railway VPS crontab:
   ```
   0 6 * * * /app/vps/nightly-cron.sh >> /var/log/nightly-audit.log 2>&1
   ```

2. Ensure env vars are set on the VPS:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `DISCORD_AUDIT_WEBHOOK_URL` (optional)
   - `RESEND_API_KEY` (optional)

### Option B: Netlify Scheduled Function

Best for: lightweight agents (no Playwright). Limited by Netlify timeout (26s free / 5min paid).

The function `netlify/functions/nightly-audit.mts` calls the `/api/admin/audits/trigger` endpoint. Only use `mode=brief` for serverless since full agent runs may timeout.

## Marking Findings

```bash
# Mark a finding as fixed
curl -X PATCH https://viralanimal.com/api/admin/audits/findings/FINDING_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "fixed"}'

# Status options: open, fixed, doing, later, ignore
```

Or use the admin dashboard at `/admin/audits`.

## Adding a New Agent

1. Create `scripts/audits/my-agent.ts`:
   ```ts
   import { insertFinding } from '@/lib/audit/insert-finding'
   import { insertMetricSnapshot } from '@/lib/audit/insert-metric'

   export async function runMyAgentAudit() {
     // Run checks, collect findings
     await insertFinding({
       agent_type: 'technical', // or 'output', 'acquisition', etc.
       severity: 'normal',
       title: 'Something needs attention',
       description: 'Details here',
       suggested_fix: 'Do X',
     })

     // Track metrics
     await insertMetricSnapshot({
       metric_name: 'my_metric',
       metric_value: 42,
       regression_threshold_percent: 20, // alert if drops >20% vs 5 days ago
     })
   }
   ```

2. Add the import and schedule to `scripts/audits/run-nightly.ts`.

## Adding a New Persona

1. Create `scripts/personas/my-persona.ts`:
   ```ts
   import { insertFinding } from '@/lib/audit/insert-finding'

   export async function runMyPersona() {
     // Simulate user journey, report frictions
     await insertFinding({
       agent_type: 'output',
       persona: 'sceptical', // or 'free_limit', 'power'
       severity: 'normal',
       title: 'Friction found during onboarding',
       description: 'The button was hard to find',
     })
   }
   ```

2. Add to the personas array in `scripts/audits/run-nightly.ts`.

## Cold Email Agent

Runs every **Friday**. Audits the cold email acquisition machine (Instantly Cloud).

**4 dimensions audited:**

1. **Domain Health** — SPF/DKIM/DMARC configured, warmup status, blacklist detection
2. **Deliverability** — open/bounce/reply/complaint rates over 14 days (alerts: open < 30%, bounce > 3%, complaint > 0.1%)
3. **Influencer Replies** — inbound replies unanswered > 48h, especially from high-follower accounts
4. **Collab Workflow** — positive replies without a promo code sent, conversion gaps

**Metrics tracked:** `cold_email_open_rate_14d`, `cold_email_reply_rate_14d`, `cold_email_bounce_rate_14d`, `cold_email_unanswered_48h`

**Requires:** `INSTANTLY_API_KEY` env var (optional — runs with DB data only if missing). Add to Railway audit service.

```bash
# Run standalone
npx tsx scripts/audits/cold-email.ts
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUDIT_CRON_SECRET` | Yes | Bearer token for `/api/admin/audits/trigger` |
| `DISCORD_AUDIT_WEBHOOK_URL` | No | Discord webhook for critical finding alerts |
| `RESEND_API_KEY` | No | Resend API key for email digest |
| `ANTHROPIC_API_KEY` | Yes | For Claude-powered agents |
| `INSTANTLY_API_KEY` | No | Instantly API for cold email campaign data |

## Discord Setup

1. Create a `#audit-alerts` channel in your Discord server
2. Go to Channel Settings > Integrations > Webhooks > New Webhook
3. Copy the webhook URL
4. Set `DISCORD_AUDIT_WEBHOOK_URL` in your env

Only **critical** severity findings trigger Discord notifications.

## KPIs Tracked

Metrics are stored in `audit_metrics_snapshots` and displayed in the admin dashboard. Regression detection automatically creates findings when a metric drops more than the configured threshold over 5 days.

## Morning Brief

Generated after each nightly run. Contains:
- New findings (sorted by severity)
- Recurring findings (2+ cycles)
- Regressions detected
- Recently fixed items
- KPI evolution (5-day trend)

Briefs are archived in Supabase Storage at `audit-screenshots/morning-briefs/YYYY-MM-DD.md`.
