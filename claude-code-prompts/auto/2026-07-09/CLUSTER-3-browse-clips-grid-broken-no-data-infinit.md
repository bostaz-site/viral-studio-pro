# Fix: Browse Clips Grid — Data Fetch, Empty State, and Error Handling

## Context
5 audit findings (104, 105, 114, 115, 149) report the same root issue: the Browse Clips grid on the dashboard shows '0 clips · sorted by Score' with 8 skeleton-loader cards that never resolve. There is no error message, no empty state, no retry button, and no timeout. Users cannot distinguish between a loading failure, an empty filter result, or a plan restriction.

## Task

### 1. Debug and fix the data fetch
- Find the Browse Clips component (likely in `app/dashboard/` or `components/dashboard/`).
- Identify the API call or data-fetching hook that populates the clip grid.
- Check for: incorrect API endpoint, missing auth headers, query params returning empty, server-side errors being swallowed.
- Fix the root cause so clips actually load when they exist.

### 2. Add a loading timeout fallback
- If the data fetch hasn't resolved after **8 seconds**, transition from skeleton loaders to an explicit error state.
- The error state should display: an error icon, the text `Couldn't load clips`, and a `Retry` button that re-triggers the fetch.

### 3. Add a proper empty state
- If the fetch succeeds but returns 0 clips, show a dedicated empty state component:
  - If the user has no clips at all: `No clips yet — upload your first stream to get started` with a CTA linking to `/upload`.
  - If a filter is active and returns 0 results: `No clips match this filter — try adjusting your selection`.
  - If clips are gated behind Pro: show a blurred/locked preview grid with an overlay: `Unlock the full clip library with Pro` and an upgrade CTA.

### 4. Distinguish error vs empty in the '0 clips' label
- Do NOT show '0 clips · sorted by Score' while skeletons are still loading. Show it only after a successful fetch returns 0 results.
- While loading, show `Loading clips...` as the label.

## Acceptance Criteria
- Clips load correctly when data exists.
- Skeleton loaders disappear after 8s max — replaced by error or empty state.
- Error state has a visible Retry button.
- Empty state copy differs based on context (no clips vs. filter vs. plan gate).
- The '0 clips' count label is never shown simultaneously with skeleton loaders.