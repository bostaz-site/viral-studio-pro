# SYSTEM REFERENCE — Admin AI Triage Layer (v1)

> Auto-classification, lead scoring, reply drafts, and thread summaries for the admin inbox.
> Model: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via direct API.
> Cost estimate: ~$30-50/month at 4500 replies/month.

---

## Architecture

| File | Role |
|---|---|
| `lib/admin/ai/prompts.ts` | All Claude prompts centralized + `fillPrompt()` helper |
| `lib/admin/ai/log-call.ts` | Admin-specific AI call logger (context_id + context_type) |
| `lib/admin/ai/reply-classifier.ts` | Classify reply sentiment + intent via Haiku |
| `lib/admin/ai/lead-scorer.ts` | 6-factor lead score (rules + Haiku reasoning) |
| `lib/admin/ai/reply-drafter.ts` | Generate 3 reply draft variants |
| `lib/admin/ai/thread-summarizer.ts` | Summarize threads > 5 messages |
| `app/api/admin/inbox/classify/route.ts` | POST — classify a single message |
| `app/api/admin/inbox/drafts/route.ts` | POST — generate reply drafts for a message |
| `app/api/admin/inbox/summarize/route.ts` | POST — summarize a thread |
| `app/api/admin/influencers/score/route.ts` | POST — compute lead score for an influencer |
| `app/api/cron/ai-triage/route.ts` | GET — batch classify + draft + score (every 10min) |

### UI Components

| File | Role |
|---|---|
| `inbox/_components/sentiment-badge.tsx` | Colored badge for sentiment (positive/neutral/negative/spam/hostile) |
| `inbox/_components/lead-score-card.tsx` | Score display (0-100) with progress bar + re-score button |
| `inbox/_components/suggested-drafts.tsx` | 3 AI draft variants with "Use this draft" buttons |
| `inbox/_components/thread-summary.tsx` | Collapsible thread summary with key points + next action |

### Modified Files

| File | Change |
|---|---|
| `thread-list.tsx` | Added sentiment badge + lead score on each thread item |
| `thread-detail.tsx` | Added ThreadSummary, LeadScoreCard, SentimentBadge, SuggestedDrafts |
| `reply-composer.tsx` | Added prefillSubject/prefillBody props for AI drafts |
| `inbox-filters.tsx` | Added "Hot Leads" filter pill |
| `page.tsx` | Updated ThreadItem interface for ai_sentiment |
| `app/api/admin/inbox/route.ts` | Added ai_sentiment to select + hot filter logic |
| `netlify.toml` | Added ai-triage cron documentation |

---

## Reply Classification

### Flow

```
Inbound reply arrives (via Instantly webhook)
    |
    v
Cron ai-triage runs every 10min
    |
    v
1. Find unclassified inbound messages (last 48h, ai_sentiment IS NULL)
2. For each (max 50 per run):
   a. Fetch influencer context
   b. Call Claude Haiku with CLASSIFY_REPLY_PROMPT
   c. Parse JSON response → sentiment, intent, confidence, key_phrases
   d. UPDATE email_messages SET ai_sentiment, ai_intent, ai_confidence, ai_classified_at
   e. If positive/neutral → generate drafts (store in human_response_drafted)
   f. Re-compute influencer lead_score
   g. Log in ai_calls
```

### Classification Schema

| Sentiment | Meaning | Suggested Action |
|---|---|---|
| `positive` | Interested, wants to proceed | `send_drafts` |
| `neutral_question` | Has questions, needs info | `send_drafts` or `manual_response` |
| `negative` | Not interested, declined | `archive` |
| `spam` | Auto-reply, OOO, irrelevant | `archive` |
| `hostile` | Angry, threatening | `block` |

### Intent Values

`interested`, `has_question`, `wants_demo`, `maybe_later`, `declined`, `unsubscribe`, `out_of_office`, `spam`, `other`

### Idempotency

A message is only classified once. The cron checks `ai_sentiment IS NULL` and the manual classify endpoint returns early if already classified.

---

## Lead Scoring

### 6-Factor Formula

| # | Factor | Weight | Source |
|---|---|---|---|
| 1 | **Niche Fit** | 25% | Rule-based (gaming=100, fitness=40, etc.) |
| 2 | **Audience Size** | 20% | Log scale (1K=30, 10K=50, 100K=70, 1M=90) |
| 3 | **Engagement Rate** | 15% | Audience size proxy (mid-tier audiences score highest) |
| 4 | **Sponsorship Likelihood** | 15% | Claude Haiku reasoning |
| 5 | **Reply Sentiment History** | 15% | Average of past sentiment scores |
| 6 | **Geo/Lang Fit** | 10% | EN+US/CA/UK=100, FR+CA=90, other=50 |

### Formula

```
score = niche×0.25 + audience×0.20 + engagement×0.15 + sponsorship×0.15 + sentiment×0.15 + geo×0.10
```

### When Computed

- On cron ai-triage (after each reply classification)
- On manual "Re-score" button click (via POST /api/admin/influencers/score)

### Storage

- `influencers.lead_score` (INTEGER 0-100)
- `influencers.lead_score_reasons` (JSONB array of strings)

---

## Reply Drafts

### 3 Variant Styles

| Style | Label | Purpose |
|---|---|---|
| `quick_yes` | Quick Yes | Short, redirects to signup/onboarding |
| `detailed` | Detailed Response | Addresses specific questions from the reply |
| `soft_pitch` | Soft Pitch | Low-pressure for hesitant leads |

### Flow

1. User clicks "Suggest reply drafts" on an inbound message
2. POST /api/admin/inbox/drafts with messageId
3. Claude Haiku generates 3 variants
4. UI shows 3 draft cards with "Use this draft" buttons
5. Click → fills composer (subject + body), user edits before sending
6. **Never auto-sent** — always human-in-the-loop

### Storage

Drafts are also stored in `email_messages.human_response_drafted` (JSONB) by the cron for positive/neutral messages.

---

## Thread Summarizer

### When Triggered

- Manually via "Summarize thread" button (only shown for threads >= 5 messages)
- POST /api/admin/inbox/summarize with influencerId

### Output

```json
{
  "summary": "2-3 sentence conversation summary",
  "status": "engaged | hesitant | declined | waiting | onboarding",
  "key_points": ["point1", "point2", "point3"],
  "next_action": "Best next step for outreach team"
}
```

### Display

Collapsible card at the top of thread detail, above messages.

---

## Hot Lead Queue

### Filter Criteria

- `influencer.lead_score >= 70`
- Last inbound message `ai_sentiment IN ('positive', 'neutral')`
- Not archived

### Access

"Hot Leads" filter pill in inbox filters (alongside All, Unread, Starred, Archived).

### Sort

By `created_at DESC` (most recent first). Lead score visible on each thread item.

---

## Cron: AI Triage

### Schedule

Every 10 minutes via external scheduler (cron-job.org, GitHub Actions, or Netlify).

```
GET /api/cron/ai-triage
Header: x-api-key: CRON_SECRET
```

### Process Per Run

1. Find up to 50 unclassified inbound messages (last 48h)
2. For each message:
   - Classify sentiment + intent
   - Generate drafts (if positive/neutral)
   - Re-compute influencer lead score
   - Log all AI calls
3. Return summary: `{ processed, classified, drafted, scored, errors }`

### Error Handling

- Each message processed in try/catch — one failure doesn't stop the batch
- AI call failures logged in `ai_calls` with `success=false`
- Errors returned in response (capped at 10)

---

## AI Call Tracking

### Table: `ai_calls`

All AI calls are logged with:
- `feature`: `reply_classification`, `lead_scoring`, `reply_drafts`, `thread_summary`
- `context_id`: message UUID or influencer UUID
- `context_type`: `email_message` or `influencer`
- `tokens_input`, `tokens_output`, `cost_usd`, `latency_ms`
- `success`, `error`

### Pricing

Claude Haiku 4.5: $1.00/1M input tokens, $5.00/1M output tokens.

### Estimated Costs Per Operation

| Operation | ~Input Tokens | ~Output Tokens | ~Cost |
|---|---|---|---|
| Classification | 500 | 150 | $0.0013 |
| Lead Scoring | 400 | 100 | $0.0009 |
| Draft Generation | 600 | 400 | $0.0026 |
| Thread Summary | 2000 | 200 | $0.0030 |

At 4500 replies/month: ~$25-40/month total.

---

## API Routes

### POST /api/admin/inbox/classify
Body: `{ messageId: UUID }`
Returns: `{ sentiment, confidence, intent, key_phrases, suggested_action, reasoning }`

### POST /api/admin/inbox/drafts
Body: `{ messageId: UUID }`
Returns: `{ drafts: [{ style, label, subject, body }] }`

### POST /api/admin/inbox/summarize
Body: `{ influencerId: UUID }`
Returns: `{ summary, status, key_points, next_action }`

### POST /api/admin/influencers/score
Body: `{ influencerId: UUID }`
Returns: `{ score, breakdown: { niche_fit, audience_size, engagement_rate, sponsorship_likelihood, reply_sentiment, geo_lang_fit }, reasons }`

### GET /api/cron/ai-triage
Auth: `x-api-key: CRON_SECRET`
Returns: `{ ok, processed, classified, drafted, scored, errors }`

---

## Environment Variables

| Var | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku API access |
| `CRON_SECRET` | Yes | Cron endpoint auth |

---

## Anti-Patterns Avoided

- Never auto-send drafts (always human-in-the-loop)
- Never re-classify same message (idempotent via ai_sentiment IS NULL check)
- Never call Claude in realtime from UI (cron + cache pattern)
- Never crash cron on single failure (try/catch per message)
- Always log in ai_calls (cost tracking)

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **INBOX** | Les classifications alimentent l'inbox unifie (sentiment, intent, suggested_action) |
| **CRM** | Les drafts et summaries enrichissent la fiche influencer dans le CRM |
| **Scoring leads (3 scores)** | `keyword_score` (scraper, pre-filtre) → `lead_score` (triage, 6 facteurs dont Claude sponsorship) → `ai_affiliate_score` (batch scoring, activation-focused). Le triage utilise lead_score pour prioriser les reponses |

---

*Document version 1.1 — Juillet 2026*
