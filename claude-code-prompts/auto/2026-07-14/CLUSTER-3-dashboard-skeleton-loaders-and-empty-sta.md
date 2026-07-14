# Fix: Add error states, timeouts, and proper empty states to dashboard

## Context
The dashboard has multiple loading/empty state issues: (1) skeleton loaders display indefinitely with no timeout or error fallback, (2) the Analytics page can't load independently if no clips exist, (3) the Upload button is coupled to the Browse grid state, and (4) the Enhance empty state has competing CTAs. All stem from missing error handling and state management patterns in dashboard views.

## Files to modify
- `app/dashboard/page.tsx` or the clip grid component (wherever skeletons are rendered)
- `app/analytics/page.tsx` (or equivalent analytics route)
- `app/enhance/page.tsx` — empty state component (line ~44-56 per finding)
- Consider creating a shared `components/dashboard/loading-error-state.tsx` component

## Requirements
1. **Skeleton timeout**: In the clip grid component, add a timeout (6-8 seconds). If data hasn't loaded by then:
   - Replace skeletons with an inline error banner: 'Couldn't load your clips. [Retry]'
   - The Retry button should re-trigger the data fetch
   - Log the timeout to your error tracking (Sentry/PostHog/console.error at minimum): `console.error('Clip grid load timeout', { userId, timestamp })`
   - Add a TODO comment: `// TODO: Send to Sentry when integrated`
2. **Decouple Upload from grid state**: Ensure the 'Upload clip' button on the dashboard works regardless of whether the clip grid has loaded. The button should navigate to /upload (or trigger the upgrade modal if at limit) even if the grid shows an error state.
3. **Analytics empty state**: Ensure the Analytics page loads independently. If no clips exist, show a proper empty state: 'No clips published yet. Upload your first clip to start tracking performance.' with a CTA to Upload. Don't show a blank page or an error.
4. **Enhance empty state CTA hierarchy**: 
   - Make 'Upload your clip' the single primary CTA (full gradient/solid button)
   - Demote 'Browse clips' to a text link below: 'or browse existing clips →'
   - Single clear next step reduces decision paralysis
5. **Create a reusable pattern**: Consider a shared `<LoadingErrorState>` component that accepts `loading`, `error`, `empty`, and `children` render props so this pattern is consistent across all dashboard views.

## Validation
- Simulate a slow/failed API response (throttle network in DevTools or temporarily break the API endpoint)
- Confirm skeletons are replaced with error + retry after ~7 seconds
- Click Retry — confirm it re-fetches
- With grid in error state, confirm Upload button still works
- Load Analytics with no clips — confirm empty state renders, not a blank page
- Load Enhance with no clips — confirm single primary CTA, not two equal buttons
- Check browser console for error logging on timeout