# Admin — AI Lead Scoring (Claude Haiku)

Version: 1.0 — 2026-07-02

## What It Does

Batch-scores influencer leads via Claude Haiku to determine affiliate partnership potential. Only the top 3% of keyword-scored leads are sent to Claude (cost control). Writes `ai_affiliate_score` (0-100) and `ai_recommendation` back to the `influencers` table.

Pipeline: **Scraper keyword_score → dynamic threshold (top 3%) → Claude Haiku batch (10/call) → ai_affiliate_score + recommendation → influencers table**

## Etat operationnel

- **0 jobs executed** to date — the cron route exists and the batch processor is ready, but no leads have been scored because the scraper pipeline has never run end-to-end (0 `lead_discovery_results` rows)
- **Scheduling**: The cron is at `POST /api/cron/ai-scoring` (CRON_SECRET auth), designed for hourly execution. No external scheduler (Railway cron / cron-job.org / Netlify scheduled function) has been configured to call it yet.
- **Cost**: Uses `ANTHROPIC_API_KEY` (API credits, billed per token). Does NOT use the Claude Max subscription. Claude Haiku 4.5 pricing: $0.25/1M input, $1.25/1M output. Daily cap: $1.00 (hardcoded in `batch-processor.ts`).

## Architecture

### UI Pages
- `/admin/ai-scoring` — Job dashboard: stats cards (total jobs, leads scored, cost, avg score), jobs table with status/progress/cost

### Code
- `lib/admin/ai-scoring/batch-processor.ts` — Orchestrator: daily cost check → dynamic threshold → select unscored leads → call Claude → write results
- `lib/admin/ai-scoring/claude-scorer.ts` — Claude Haiku API call (direct fetch to `api.anthropic.com`, not SDK). Batch of up to 10 leads per call.
- `lib/admin/ai-scoring/threshold-calculator.ts` — Queries top 1000 `lead_discovery_results` by keyword_score, returns the 97th percentile value (min 40).
- `lib/admin/ai-scoring/prompt-builder.ts` — System prompt + batch user prompt builder
- `lib/admin/ai-scoring/cost-tracker.ts` — Logs each call to `ai_calls` table with tokens, cost, latency, success/error

### API Routes
- `POST /api/cron/ai-scoring` — Hourly cron entry point (CRON_SECRET auth). Skips silently if ANTHROPIC_API_KEY not set.
- `GET /api/admin/ai-scoring/jobs` — List scoring jobs
- `POST /api/admin/ai-scoring/jobs` — Manually trigger a scoring batch
- `GET /api/admin/ai-scoring/jobs/[id]` — Job detail

### Database Tables
- `ai_scoring_jobs` — Job tracking (status: queued/processing/completed/failed, total_leads, processed_leads, cost_cents)
- `affiliate_signal_snapshots` — Per-lead scoring results (ai_job_id, claude_model, confidence, strengths, concerns, ai_recommendation, ai_reasoning)
- `ai_calls` — Cost logging for all AI calls across the app (feature, model, tokens_input, tokens_output, cost_usd, latency_ms)

### Columns Written to `influencers`
- `ai_affiliate_score` (INT 0-100) — Claude's overall partnership score
- `ai_scored_at` (TIMESTAMPTZ) — When the lead was last scored
- `ai_recommendation` (TEXT) — One of: `high_priority`, `medium_priority`, `low_priority`, `skip`

### Scoring Factors (Claude Prompt)
Claude evaluates each lead on:
- Niche fit (relevance to video editing / content creation)
- Audience size and engagement proxy
- Sponsorship/affiliate likelihood (bio signals, promoted products)
- Reply sentiment history (if available)
- Geographic/language fit

Output per lead: score (0-100), recommendation, confidence (0-1), strengths[], concerns[], reasoning.

## Configuration

| Constant | Value | Location |
|----------|-------|----------|
| BATCH_SIZE | 10 leads/call | `batch-processor.ts` |
| MAX_DAILY_COST_USD | $1.00 | `batch-processor.ts` |
| MAX_RETRIES | 2 | `batch-processor.ts` |
| MODEL | claude-haiku-4-5-20251001 | `claude-scorer.ts` |
| Threshold min | 40 (keyword_score) | `threshold-calculator.ts` |
| Threshold percentile | Top 3% | `threshold-calculator.ts` |
| Cache TTL | 7 days (skip re-scoring) | `batch-processor.ts` |

## Systemes connexes

- **Scraper** (`docs/acquisition-scraper.md`) — Provides the `lead_discovery_results` rows with `keyword_score` that AI scoring consumes. The dynamic threshold calculator reads from this table to determine the top 3% cutoff.
- **CRM** (`docs/admin-crm.md`) — AI scoring writes `ai_affiliate_score` and `ai_recommendation` to the `influencers` table. These fields are displayed in the CRM detail drawer and available as a column in the lead list. Note: the CRM predefined views currently filter by `lead_score` (rule-based), not `ai_affiliate_score`.
- **Match Engine** (`/admin/match-engine`) — Currently uses `lead_score` (rule-based from `lib/admin/ai/lead-scorer.ts`) for the lead_boost factor in matching, NOT `ai_affiliate_score`. Future integration possible.
- **Offer Generator** (`/admin/offer-generator`) — Does not currently read `ai_affiliate_score` or `ai_recommendation`. Templates use rule-based lead data only.
- **Cost Tracking** — All Claude API calls are logged to the `ai_calls` table with full token/cost breakdown. Viewable in `/admin/costs`.
