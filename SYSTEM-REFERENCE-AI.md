# SYSTEM REFERENCE — AI Infrastructure

> Source of truth for all AI API calls, cost tracking, and model usage.

---

## Architecture

| File | Role |
|---|---|
| `lib/ai/call-logger.ts` | Fire-and-forget logger — computes cost, inserts into `ai_calls` |
| `lib/ai/mood-detector.ts` | Claude Haiku mood detection — WRAPPED with call-logger |
| `lib/ai/mood-presets.ts` | Mood preset configurations |
| `vps/lib/hook-generator.js` | Claude Haiku hook text generation — runs on Railway VPS, NOT wrapped (separate deployment) |
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
| `claude-haiku-4-5-20251001` | $1.00 | $5.00 | Mood detection |
| `claude-sonnet-4-5` | $3.00 | $15.00 | Reserved (complex analysis) |
| `gemini-flash-1.5` | $0.075 | $0.30 | Reserved (vision tasks) |

### Audio-based models

| Model ID | Cost ($/second) | Used for |
|---|---|---|
| `assemblyai-best` | $0.000103 | Transcription (VPS-side, not logged yet) |

### Cost formula
- Token models: `(tokensInput / 1M) * inputPer1M + (tokensOutput / 1M) * outputPer1M`
- Audio models: `audioSeconds * perSecondAudio`

---

## Feature Names (canonical)

| Feature | Model | Where called | Wrapped? |
|---|---|---|---|
| `mood_detection` | claude-haiku-4-5-20251001 | `lib/ai/mood-detector.ts` | Yes |
| `hook_generation` | claude-haiku-4-5-20251001 | `vps/lib/hook-generator.js` | No (VPS) |
| `caption_engine` | — | `lib/distribution/caption-engine.ts` | N/A (no AI call, template-based) |
| `vision` | — | Reserved for future use | — |

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

## VPS Hook Generator (NOT wrapped)

`vps/lib/hook-generator.js` makes Claude Haiku calls for hook text generation. It runs on Railway VPS as a separate Node.js process. To track its costs:
- Option A: Add logging inside the VPS code (requires Railway deployment)
- Option B: Log from the Next.js proxy (`app/api/render/hook/route.ts`) after receiving the VPS response — but this only captures requests that go through the proxy, not direct VPS calls.

Currently **not tracked**. Flagged for future work.

---

## Axes d'amelioration

1. **Wrap VPS hook generation** — Either add call-logger to VPS or proxy through Next.js
2. **Admin dashboard** — Create `/admin/ai-costs` page showing cost trends, top users, feature breakdown
3. **Budget alerts** — Warn when monthly AI spend exceeds threshold
4. **AssemblyAI tracking** — VPS transcription calls not yet logged
5. **Rate limiting per user** — Use ai_calls data to enforce per-user AI call limits
