# Fix: Browse Clips Grid — Data Fetch Failure & Missing Empty/Error States

## Context
The Browse Clips grid on `/dashboard` shows `0 clips · sorted by Score` and renders 8 skeleton placeholder cards that never resolve. This is the most-reported bug across the entire audit (7 findings). Users see a broken-looking page that erodes trust immediately. The root cause is twofold: (1) the API call to fetch clips is either failing silently or returning empty results with no error propagation, and (2) the UI has no timeout fallback, no error state, and no proper empty state — skeletons just hang forever.

## Requirements
1. Find the clips fetch call (likely in a React component or hook on the Browse/dashboard page). Trace why it returns 0 results — check the API route, any filters being applied, and the database query.
2. Add a loading timeout: if the fetch hasn't resolved within 8 seconds, transition from skeleton state to an error state.
3. Implement three distinct UI states for the clip grid:
   - **Loading**: Show skeleton cards with a subtle shimmer animation. Hide the `0 clips` count text until data resolves.
   - **Error**: Show an inline error banner: `Couldn't load clips. [Retry]` with a retry button that re-triggers the fetch. Log the error to the error tracking service (Sentry or equivalent).
   - **Empty (0 results)**: Show a proper empty-state illustration with copy: `No clips found — try adjusting your filters or upload your first clip.` Include a CTA to upload.
4. Never display the clip count (`X clips · sorted by Score`) until the fetch has successfully resolved. During loading, show a placeholder like `Loading clips...`.
5. If Browse content is gated behind a paid plan for free users, replace skeletons with blurred/locked card previews with a lock icon and `Upgrade to browse trending clips` CTA.
6. Add an integration test that covers: successful load, empty result, network error, and timeout scenarios for the clips grid.

## Files to Investigate
- Dashboard page component (likely `app/dashboard/page.tsx` or similar)
- Clips grid component (look for skeleton rendering logic)
- API route for fetching clips (e.g., `app/api/clips/route.ts`)
- Any React Query / SWR / fetch hooks used for clip data