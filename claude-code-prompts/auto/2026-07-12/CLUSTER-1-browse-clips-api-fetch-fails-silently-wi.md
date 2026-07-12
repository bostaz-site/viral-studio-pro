# Fix: Browse Clips Infinite Skeleton Loading

## Context
The Browse Clips grid at `/dashboard` shows `0 clips · sorted by Score` with skeleton card placeholders that never resolve. This is the primary content discovery surface — it's a full session blocker. The root cause is that the clip-fetch API call either silently returns an error (4xx/5xx), returns an empty array without signaling an error, or hangs indefinitely. The frontend has no timeout, no error boundary, and no empty-state UI.

## Requirements
1. Find the clip-fetch API call in the Browse view component (likely in `app/dashboard` or a `browse` route). Trace the data-fetching hook or `useEffect` that populates the clip grid.
2. Add a **timeout of 8 seconds** — if the fetch hasn't resolved, transition to an error state.
3. Add proper error handling for the fetch: catch network errors, non-2xx responses, and empty-but-successful responses.
4. Replace the infinite skeleton with a real **error state component**: `'Failed to load clips — Retry'` with a retry button that re-triggers the fetch.
5. Add a proper **empty state** for when the API returns 0 clips legitimately (e.g., new user): `'No clips yet — upload your first clip'` with a CTA to `/upload`.
6. Add `console.error` logging (and ideally a server-side log/alert) when the clip-fetch fails for an authenticated user, including the HTTP status and response body.
7. Check the API endpoint itself — verify it requires auth, that the auth token is being sent correctly, and that it returns clips for the authenticated user's account. Fix any backend issues found.

## Files likely involved
- `app/dashboard/page.tsx` or `app/dashboard/browse/page.tsx`
- The clip-fetching hook/service (e.g., `hooks/useClips.ts`, `lib/api/clips.ts`)
- The skeleton/card grid component
- The API route handler (e.g., `app/api/clips/route.ts`)

## Acceptance Criteria
- Skeleton cards never persist for more than 8 seconds
- On API failure: user sees a clear error message with a retry button
- On 0 clips (legitimate): user sees an empty state with upload CTA
- API errors are logged with status code and user ID
- Happy path: clips load and render in the grid within 2-3 seconds