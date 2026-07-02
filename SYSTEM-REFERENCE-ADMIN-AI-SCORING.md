# SYSTEM REFERENCE — AI Affiliate Scoring (v2 — Activation-Focused)

> Source de verite pour le scoring Claude Haiku des leads.
> Derniere mise a jour : 2026-07-02.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/ai-scoring/batch-processor.ts` | Orchestrateur — threshold, batch, retry, cost cap, contactability |
| `lib/admin/ai-scoring/claude-scorer.ts` | Claude Haiku API call — batch 10 leads, activation-focused JSON parse, final score computation |
| `lib/admin/ai-scoring/prompt-builder.ts` | System prompt (activation criteria) + user prompt (with cadence data) + token estimator |
| `lib/admin/ai-scoring/threshold-calculator.ts` | Dynamic threshold — learning mode (top 10% + random 3% sample) or optimized (top 3%) |
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
3. Calculate dynamic threshold:
   - learning mode (default): top 10% of keyword_score + random 3% sample from 40-70 bucket
   - optimized mode: top 3% of keyword_score
4. Find unscored leads with keyword_score >= threshold
5. Filter out leads scored < 7 days ago (cache)
6. Compute deterministic contactability_score per lead (email, business contact, links)
7. Batch 10 leads → Claude Haiku (activation-focused prompt)
8. Parse JSON response → compute final_score with formula
9. Update:
   - affiliate_signal_snapshots (all V2 sub-scores + offer angle)
   - influencers.ai_affiliate_score + ai_recommendation (backward compat)
   - lead_discovery_results.contactability_score
10. Log cost to ai_calls table
11. Update ai_scoring_jobs with results
```

---

## Claude Prompt (V2 — Activation-Focused)

Model: `claude-haiku-4-5-20251001`
Max tokens: 3000
Timeout: 30s

### Scoring Criteria (5 factors + risk penalty)

| # | Factor | Weight | What it measures |
|---|--------|--------|-----------------|
| 1 | **Activation Likelihood** | 30% | Upload cadence (3+/14d = strong), makes Shorts/vertical, CTAs in descriptions, low-friction style, recycles content |
| 2 | **Audience Fit** | 25% | Creator-facing audience (streamers, clippers who'd BUY a clipping tool), talks about content creation |
| 3 | **Partner Intent** | 20% | Uses affiliate codes, 1-5 sponsors (sweet spot), organic CTAs |
| 4 | **Content Quality** | 10% | Professional but not too polished (factored into fit_score) |
| 5 | **Reach Quality** | 10% | Recent views vs subscribers ratio (factored into fit_score) |
| 6 | **Risk** | -penalty | Fan/reupload account, inactive 90d+, kids content, copyright-fragile, too premium |

### Response Format (per lead)

```json
{
  "handle": "creator_handle",
  "fit_score": 0-100,
  "activation_score": 0-100,
  "partner_intent_score": 0-100,
  "risk_score": 0-100,
  "confidence": 0.0-1.0,
  "activation_reason": "1 sentence",
  "main_concern": "1 sentence",
  "recommended_offer_angle": "1 sentence",
  "priority": "high_priority | medium_priority | low_priority | skip"
}
```

### Final Score Formula

```
final_score = activation * 0.30
            + fit * 0.25
            + partner_intent * 0.20
            + contactability * 0.15    ← deterministic, NOT from Claude
            - risk * 0.25
```

Clamped to [0, 100].

### Contactability Score (deterministic, from scraper data)

| Signal | Points |
|--------|--------|
| Base (discoverable) | +10 |
| Has email | +40 |
| Business contact keyword | +20 |
| 3+ links | +15 |
| 1-2 links | +10 |
| Link aggregator (linktr.ee, etc.) | +15 |

Max: 100.

### Backward Compatibility

- `influencers.ai_affiliate_score` = final_score (same column, same 0-100 range)
- `influencers.ai_recommendation` = high/medium/low/skip at same thresholds (75/50/25)
- Match Engine and Offer Generator consume these unchanged

---

## Threshold Modes

Config: `AI_SCORING_MODE` env var (default: `learning`)

| Mode | Threshold | Extra |
|------|-----------|-------|
| `learning` | Top 10% of keyword_score (min 30) | + random 3% sample from 40-70 bucket for calibration |
| `optimized` | Top 3% of keyword_score (min 40) | Production mode once calibrated |

Both modes keep: $1/day cost cap, 7-day cache, batch 10.

---

## Cost Optimization

- Haiku: $0.25/1M input, $1.25/1M output
- Batch 10 leads per call (reduce overhead)
- ~$0.003 per lead → $30/month for 10k leads
- Daily cap: $1.00 (auto-stop)
- 7-day cache: skip recently scored leads
- Max tokens increased to 3000 (V2 response is larger)

---

## Database

| Table | Purpose |
|---|---|
| `ai_scoring_jobs` | Job tracking (status, counts, cost, timing) |
| `affiliate_signal_snapshots` | V2: ai_fit_score, ai_activation_score, ai_partner_intent_score, ai_risk_score, ai_activation_reason, ai_main_concern, ai_recommended_offer_angle + V1 columns |
| `lead_discovery_results` | Extended: recent_upload_count, last_upload_at, contactability_score |
| `influencers` | ai_affiliate_score (= final_score), ai_scored_at, ai_recommendation |
| `ai_calls` | Existing — logs all Claude API usage |

Migration: `20260702_ai_scoring_activation_v2.sql`

---

## Systemes Connexes

### Consomme (inputs)

| Source | Data | Fichier |
|--------|------|---------|
| **Scraper** | keyword_score, promoted_products, links, strongSignals | `lib/admin/scraper/keyword-scorer.ts` |
| **Scraper** | recent_upload_count, last_upload_at (cadence) | `lib/admin/scraper/youtube.ts` → `getRecentVideoDescriptions()` |
| **Scraper** | has_email, email, isBusinessContact → contactability_score | `lib/admin/scraper/youtube.ts` → `extractEmailsFromText()` |

### Ecrit (outputs)

| Target | Data | Fichier consommateur |
|--------|------|---------------------|
| **CRM** (`influencers`) | ai_affiliate_score, ai_recommendation | `lib/admin/match-engine/scorer.ts`, `app/(dashboard)/admin/influencers/` |
| **Match Engine** | ai_affiliate_score (niche_fit factor) | `lib/admin/match-engine/scorer.ts` |
| **Offer Generator** | ai_recommended_offer_angle (via affiliate_signal_snapshots) | `lib/admin/offer-generator/template-renderer.ts` |
| **Snapshots** (`affiliate_signal_snapshots`) | Full V2 sub-scores for analytics | `app/(dashboard)/admin/ai-scoring/page.tsx` |

---

## Anti-Patterns (DO NOT)

- Score all leads (waste $$$, threshold + learning mode only)
- Call Claude without 7-day cache check
- Batch > 15 leads (context limits)
- Forget to log costs (ai_calls table)
- Block cron if Claude fails (retry 2x, then mark failed)
- Exceed $1/day without alert
- Ask Claude to compute contactability (it's deterministic — compute locally)
- Ignore cadence data (upload frequency is the #1 activation signal)
