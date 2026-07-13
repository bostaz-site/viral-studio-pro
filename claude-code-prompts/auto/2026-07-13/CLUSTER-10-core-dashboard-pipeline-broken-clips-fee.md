# Fix: Core Dashboard & Pipeline Broken — Clips Feed, Analytics, and Output Quality

## Context
Finding 102: The dashboard clip grid shows 0 clips and the upload CTA leads to anxiety because surrounding context is broken. Finding 104: Analytics is unreachable because upstream flows (clip feed, upload) are broken. Finding 119: Output clips contain raw stream UI overlays (chat, HUD, scoreboard). Finding 128: The clip hook timing wastes the first 2 seconds on buildup instead of the emotional peak.

## Requirements

### 1. Fix Dashboard Clips Feed (Finding 102)
- Find the clips grid data fetching logic (search for clip list query, `useQuery`, `fetch` in `app/dashboard/` or `components/dashboard/`).
- Debug why the grid returns 0 clips — check:
  - API endpoint returning correct data (test with curl)
  - Auth token being passed correctly
  - Query filters (is it filtering by a status that excludes all clips?)
- Decouple the upload CTA from the grid state: the 'Upload clip' button should always work regardless of whether the grid loaded.
- Add a proper empty state for 0 clips: 'No clips yet — upload your first clip to get started' with a prominent upload button.

### 2. Fix Analytics Reachability (Finding 104)
- Ensure the Analytics page (`app/analytics/` or `app/dashboard/analytics/`) loads independently of clip publish state.
- If no clips exist, show an empty state: 'No analytics yet — publish your first clip to see performance data.'
- Do not block the Analytics route behind clip existence.

### 3. Output Quality — Stream Overlay Cropping (Finding 119)
- This is a render pipeline issue. Find the crop/composition stage (search for `ffmpeg`, `crop`, `render`, `frame` in the backend or processing service).
- Add a TODO or implement: auto-detect and crop/mask common stream UI elements (chat overlay in top-right, game HUD in bottom-left).
- If full auto-detection is not feasible now, add a manual crop region adjustment in the clip editor UI.
- Consider adding a 'Clean frame' toggle that applies edge blur/vignette to hide stream UI.

### 4. Hook Timing Optimization (Finding 128)
- In the clip trim/selection logic, add guidance or auto-detection for emotional peaks.
- Add a TODO: implement a 'flash-forward cold open' option that places the highest-energy frame in the first 0.5s.
- At minimum, surface a recommendation in the clip editor: 'Tip: Start your clip at the reaction moment for better hooks.'

## Files to Modify
- Dashboard clips grid component and its data fetching
- Analytics page component
- Render/processing pipeline (backend)
- Clip editor/trim UI

## Acceptance Criteria
- Dashboard clip grid loads and displays clips (or a proper empty state).
- Upload CTA works independently of grid state.
- Analytics page loads with an empty state when no clips exist.
- A plan exists (even as TODOs) for stream overlay cropping and hook timing in the render pipeline.