# SYSTEM REFERENCE — AI Affiliate Scoring (v1)

> Source de verite pour le scoring Claude Haiku des top 3% leads.
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/ai-scoring/batch-processor.ts` | Orchestrateur — threshold, batch, retry, cost cap |
| `lib/admin/ai-scoring/claude-scorer.ts` | Claude Haiku API call — batch 10 leads, JSON parse |
| `lib/admin/ai-scoring/prompt-builder.ts` | System prompt + user prompt + token estimator |
| `lib/admin/ai-scoring/threshold-calculator.ts` | Dynamic top 3% threshold from recent results |
| `lib/admin/ai-scoring/cost-tracker.ts` | Log to ai_calls + daily cost check ($1/day cap) |
| `app/api/cron/ai-scoring/route.ts` | Hourly cron — CRON_SECRET auth |
| `app/api/admin/ai-scoring/jobs/route.ts` | GET list + POST manual trigger |
| `app/api/admin/ai-scoring/jobs/[id]/route.ts` | GET job detail + snapshots |
| `app/(dashboard)/admin/ai-scoring/page.tsx` | Dashboard — jobs table, stats, run button |

---

## Pipeline

```
1. Cron fires hourly (POST /api/cron/ai-scoring)
2. Check daily cost < $1.00 (safety cap)
3. Calculate dynamic threshold (top 3% of keyword_score)
4. Find unscored leads with keyword_score >= threshold
5. Filter out leads scored < 7 days ago (cache)
6. Batch 10 leads → Claude Haiku
7. Parse JSON response → update:
   - affiliate_signal_snapshots (AI columns)
   - influencers.ai_affiliate_score + ai_recommendation
8. Log cost to ai_calls table
9. Update ai_scoring_jobs with results
```

---

## Claude Prompt

Model: `claude-haiku-4-5-20251001`
Max tokens: 2000
Timeout: 30s

Scoring criteria (6 factors):
- Niche fit with creator economy/AI tools (25%)
- Already promotes competitor apps (25%)
- Audience size & engagement (15%)
- Content quality & professionalism (15%)
- Activity & responsiveness (10%)
- Affiliate signals in bio/posts (10%)

Recommendations:
- `high_priority` (75+): Contact immediately
- `medium_priority` (50-74): Worth contacting
- `low_priority` (25-49): Contact if capacity allows
- `skip` (<25): Don't contact

---

## Cost Optimization

- Haiku: $0.25/1M input, $1.25/1M output
- Batch 10 leads per call (reduce overhead)
- ~$0.003 per lead → $30/month for 10k leads
- Daily cap: $1.00 (auto-stop)
- 7-day cache: skip recently scored leads
- Top 3% only: ~30 leads/day from 1000 discovered

---

## Database

| Table | Purpose |
|---|---|
| `ai_scoring_jobs` | Job tracking (status, counts, cost, timing) |
| `affiliate_signal_snapshots` | Extended with AI columns (confidence, strengths, concerns, recommendation) |
| `influencers` | Extended with ai_affiliate_score, ai_scored_at, ai_recommendation |
| `ai_calls` | Existing — logs all Claude API usage |

---

## Anti-Patterns (DO NOT)

- Score all leads (waste $$$, top 3% only)
- Call Claude without 7-day cache check
- Batch > 15 leads (context limits)
- Forget to log costs (ai_calls table)
- Block cron if Claude fails (retry 2x, then mark failed)
- Exceed $1/day without alert
