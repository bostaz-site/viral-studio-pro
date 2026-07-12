# Fix: Settings Page Infinite Loading Spinner

## Context
Navigating to `/settings` renders only a centered `Loading…` animation that never resolves. The page blocks its full render on one or more async data fetches (profile, billing/Stripe subscription, connected integrations) that are silently failing. There is no timeout, no error boundary, no shell/partial render. This is a complete page failure for paying users.

## Requirements
1. Find the Settings page component (likely `app/settings/page.tsx`) and identify all data fetches that block render.
2. Refactor to **render a page shell immediately** (navigation, section headers, static content) and load dynamic data into each section independently.
3. Add a **timeout of 5 seconds per fetch** — if any individual section's data hasn't loaded, show an inline error for that section with a retry button, not a full-page spinner.
4. Add an **error boundary** wrapping the settings page so unhandled exceptions render a fallback UI instead of a white screen or infinite spinner.
5. Investigate the specific API calls failing: check auth token validity, endpoint availability, and whether Supabase/Stripe API calls are erroring. Fix any backend issues.
6. Add logging for settings page load failures including which specific fetch failed and the error.

## Files likely involved
- `app/settings/page.tsx` (or `app/settings/layout.tsx`)
- Data-fetching hooks for profile, billing, integrations
- API routes: `/api/settings`, `/api/profile`, `/api/billing`, etc.

## Acceptance Criteria
- Settings page shell renders within 1 second of navigation
- Each data section loads independently with its own loading/error state
- No full-page spinner ever persists more than 5 seconds
- On fetch failure: user sees `'Failed to load [section]. Retry'` with a retry button and support link
- Static settings (e.g., account email, plan name from session) are always visible