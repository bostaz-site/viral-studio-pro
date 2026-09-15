---
name: render-test
description: Run a render test via the API and report results. Use /render-test [clip_id].
---

# Render test skill

1. POST `/api/render` with `{ clip_id, source: 'trending', settings: { captions: { enabled: true, style: 'hormozi' } } }`
2. Poll `GET /api/render/status?clip_id=<id>` every 5s until done/error
3. Read `render_jobs.debug_log` for the job via Supabase MCP
4. Extract and report in table format:
   - TRANSFORM SCORE: x/3
   - CONTRACT: each feature (applied/skipped/failed + reason)
   - Layout chosen (fullframe/fit/reaction/duo/split-screen)
   - Captions: style, word count
   - SFX: count placed
   - DIVERSIFY seed + key params
   - Any FAILED/DEGRADED/SKIPPED lines
   - Duration, quality tier, output size
5. If clip_id not provided, find the latest viral trending clip (score ≥ 75, < 6h old)
