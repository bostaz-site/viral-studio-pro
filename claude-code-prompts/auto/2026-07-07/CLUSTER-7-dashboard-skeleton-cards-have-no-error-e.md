# Fix: Add Error and Empty States to Dashboard Clip Grid

## Context
The dashboard clip grid shows skeleton loading cards indefinitely with no timeout, error state, or retry button (finding 105). Users can't tell if clips are loading, if there are no clips, or if the fetch failed. This is a missing error boundary / timeout issue in the data-fetching layer.

## Task
1. Find the clip grid component on the dashboard (search for skeleton card rendering, clip list/grid, or the data-fetching hook that populates it).
2. Add a **timeout** (8 seconds) to the data fetch. If the fetch hasn't resolved after 8s, transition to an error state.
3. Implement three distinct UI states:
   - **Loading**: Current skeleton cards (but with a max duration of 8s)
   - **Error**: Replace skeletons with an error card: icon + 'Couldn't load your clips' + 'Retry' button that re-triggers the fetch. Optionally show a 'Check status' link.
   - **Empty (no clips)**: Show an empty state with illustration: 'No clips yet — upload your first stream clip to get started' with a CTA to `/upload`.
   - **Empty (filter applied)**: If filters are active and results are 0: 'No clips match your filters — try adjusting them' with a 'Clear filters' button.
4. Ensure the retry button resets the loading state and re-fires the data fetch.
5. Add a subtle inline status indicator or toast if the error persists after retry.

## Acceptance Criteria
- Skeleton cards disappear after 8s max, replaced by error or empty state
- Error state shows retry button that works
- Empty state is visually distinct from error state with appropriate copy
- Filter-empty state is distinguishable from no-clips-ever state