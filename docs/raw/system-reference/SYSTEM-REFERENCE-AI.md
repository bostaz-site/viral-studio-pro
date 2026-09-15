# SYSTEM REFERENCE — AI Infrastructure (v2)

> Source of truth for all AI API calls, cost tracking, and model usage.
> Derniere mise a jour : 2026-07-02.

---

## Architecture

| File | Role |
|---|---|
| `lib/ai/call-logger.ts` | Fire-and-forget logger — computes cost, inserts into `ai_calls` |
| `lib/ai/mood-detector.ts` | Claude Haiku mood detection — wrapped with call-logger |
| `lib/ai/mood-presets.ts` | Mood preset configurations |
| `lib/admin/ai/log-call.ts` | Admin AI logger variant (adds context_id/context_type) |
| `lib/audit/agent-runner.ts` | Audit agent framework — wrapped with logAiCall |
| `lib/audit/persona-runner.ts` | Persona test runner — wrapped with logAiCall |
| `lib/audit/roi-predictor.ts` | ROI prediction — wrapped with logAiCall |
| `lib/audit/strategic-runner.ts` | Strategic agent — wrapped with logAiCall |
| `vps/lib/hook-generator.js` | Claude Haiku hook text generation — logs directly via supabase-client |
| `vps/lib/whisper-client.js` | OpenAI Whisper transcription — logs directly via supabase-client |
| `supabase/migrations/20260503_ai_calls.sql` | Table definition + RLS + indexes |

---

## Call Logger (`lib/ai/call-logger.ts`)

### Usage

```typescript
import { logAiCall } from '@/lib/ai/call-logger'

const start = Date.now()
// ... make API call ...
const latencyMs = Date.now() - start

logAiCall({
  userId: user.id,           // optional — null for system/cron calls
  model: 'claude-haiku-4-5-20251001',
  feature: 'mood_detection', // canonical feature name
  tokensInput: data.usage?.input_tokens,
  tokensOutput: data.usage?.output_tokens,
  latencyMs,
  success: true,
  metadata: { clipId: '...' },
})
```

### Behavior
- **Fire-and-forget**: `logAiCall()` is async but failures are caught silently (console.warn only). It never blocks the caller.
- **Cost computation**: Automatically calculated from the model's pricing table.
- **Insert via service_role**: Uses `createAdminClient()` to bypass RLS.

### VPS logging
The VPS (Railway) cannot import from the Next.js app. Instead, `hook-generator.js` and `whisper-client.js` insert directly into `ai_calls` via `supabase-client.js` (service role). Same fire-and-forget pattern — errors are caught silently.

### How to wrap a new AI call
1. Record `Date.now()` before the API call
2. After the call, compute `latencyMs = Date.now() - start`
3. Extract token usage from the API response
4. Call `logAiCall()` with the appropriate `feature` name
5. On error paths, still call `logAiCall()` with `success: false` and `error` message

---

## Pricing Table

### Token-based models

| Model ID | Input ($/1M tokens) | Output ($/1M tokens) | Used for |
|---|---|---|---|
| `claude-haiku-4-5-20251001` | $1.00 | $5.00 | Mood detection, hook generation, ROI prediction, lead scoring, reply classification, anomaly detection |
| `claude-sonnet-4-6` | $3.00 | $15.00 | Audit agents (21 nightly), persona tests, strategic agents |
| `gemini-flash-1.5` | $0.075 | $0.30 | Reserved (vision tasks) |

### Audio-based models

| Model ID | Cost | Used for |
|---|---|---|
| `whisper-1` | $0.006/minute ($0.0001/second) | Transcription (VPS-side) |

### Cost formula
- Token models: `(tokensInput / 1M) * inputPer1M + (tokensOutput / 1M) * outputPer1M`
- Audio models: `audioSeconds * perSecondAudio`

---

## Feature Names (canonical)

| Feature | Model | Where called | Tracked? |
|---|---|---|---|
| `mood_detection` | claude-haiku-4-5-20251001 | `lib/ai/mood-detector.ts` | Yes (logAiCall) |
| `hook_generation` | claude-haiku-4-5-20251001 | `vps/lib/hook-generator.js` | Yes (direct Supabase insert) |
| `transcription_whisper` | whisper-1 | `vps/lib/whisper-client.js` | Yes (direct Supabase insert) |
| `audit_agent` | claude-sonnet-4-6 | `lib/audit/agent-runner.ts`, `persona-runner.ts`, `roi-predictor.ts`, `strategic-runner.ts` | Yes (logAiCall) |
| `lead_scoring` | claude-haiku-4-5-20251001 | `lib/admin/ai/lead-scorer.ts` | Yes (logAdminAiCall) |
| `lead_scoring_batch` | claude-haiku-4-5-20251001 | `lib/admin/ai-scoring/claude-scorer.ts` | Yes (cost-tracker.ts) |
| `reply_classification` | claude-haiku-4-5-20251001 | `lib/admin/ai/reply-classifier.ts` | Yes (logAdminAiCall) |
| `reply_drafts` | claude-haiku-4-5-20251001 | `lib/admin/ai/reply-drafter.ts` | Yes (logAdminAiCall) |
| `thread_summary` | claude-haiku-4-5-20251001 | `lib/admin/ai/thread-summarizer.ts` | Yes (logAdminAiCall) |
| `watchdog_anomaly_detection` | claude-haiku-4-5-20251001 | `lib/admin/watchdog/anomaly-detector.ts` | Yes (logAiCall) |

---

## Table: `ai_calls`

```sql
ai_calls (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID FK profiles (nullable — null for system/cron),
    model       TEXT NOT NULL,
    feature     TEXT NOT NULL,
    tokens_input  INTEGER,
    tokens_output INTEGER,
    cost_usd    NUMERIC(10,6),
    latency_ms  INTEGER,
    success     BOOLEAN DEFAULT TRUE,
    error       TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
)
```

### RLS
- RLS enabled, **no user-facing policies**.
- Only `service_role` (admin client) can read/write.
- User-facing dashboard should query via an admin API route.

### Indexes
- `(created_at DESC)` — recent calls
- `(user_id, created_at DESC) WHERE user_id IS NOT NULL` — per-user history
- `(feature, created_at DESC)` — cost by feature
- `(model, created_at DESC)` — cost by model

### Example queries

```sql
-- Total cost last 30 days
SELECT SUM(cost_usd) FROM ai_calls WHERE created_at > NOW() - INTERVAL '30 days';

-- Cost breakdown by feature
SELECT feature, COUNT(*), SUM(cost_usd), AVG(latency_ms)
FROM ai_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY feature;

-- Cost per user
SELECT user_id, SUM(cost_usd)
FROM ai_calls
WHERE user_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id ORDER BY 2 DESC;
```

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **ENHANCE** | Consomme mood_detection (mood-detector.ts) et hook_generation (VPS) |
| **AI-SCORING** | Batch scoring de leads via claude-scorer.ts (son propre cost-tracker) |
| **AUDITS** | 21 agents nightly + persona tests + ROI predictor + strategic agents |
| **Admin Costs** | Dashboard `/admin/costs` agrege les donnees de `ai_calls` pour le suivi budgetaire |
| **CRM (Inbox)** | reply_classification, reply_drafts, thread_summary pour le triage des reponses |
| **WATCHDOG** | anomaly_detection integree dans runAllChecks() |

---

## Axes d'amelioration

1. **Admin dashboard** — Create `/admin/ai-costs` page showing cost trends, top users, feature breakdown
2. **Budget alerts** — Warn when monthly AI spend exceeds threshold
3. **Rate limiting per user** — Use ai_calls data to enforce per-user AI call limits

---

*Version 2.0 — Juillet 2026*
