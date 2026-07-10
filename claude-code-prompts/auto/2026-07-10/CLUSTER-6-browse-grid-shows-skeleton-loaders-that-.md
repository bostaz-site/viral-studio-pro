# Fix: Browse Grid Skeleton Loaders Never Resolve

## Context
The Browse Clips grid on the dashboard shows '0 clips · sorted by Score' with 8 skeleton cards that never load. There's no spinner, no timeout, no empty state, and no paywall context. This makes the product look broken.

## Requirements
1. Find the Browse Clips grid component (likely in `components/dashboard/browse-clips.tsx` or similar).
2. **Fix the data fetch:** Investigate why clips aren't loading. Check the API route, query, and any authentication/plan gating. If the fetch is failing silently, add error handling.
3. **Add loading states:**
   - While fetching: show skeleton cards with a subtle pulse animation AND a timeout (e.g., 10 seconds).
   - On timeout: replace skeletons with an error message: 'Clips took too long to load. [Retry]'
   - On empty result: replace skeletons with a proper empty-state illustration and copy: 'No clips found — try uploading your first clip or adjusting filters.'
4. **Add paywall-aware state (if clips are gated for free users):**
   - Show blurred thumbnail placeholder cards with a lock icon overlay.
   - Add copy: 'Upgrade to Pro to browse trending clips'
   - Never show raw skeleton cards as a final rendered state.
5. Ensure the '0 clips' header text updates dynamically based on actual clip count.

## Files likely involved
- `components/dashboard/browse-clips.tsx` (or grid component)
- API route for fetching clips (e.g., `app/api/clips/route.ts`)
- Empty state / illustration assets

## Acceptance Criteria
- Skeleton cards are never the final rendered state.
- Loading has a timeout with a retry option.
- Empty state has a proper illustration and helpful copy.
- If free-tier gated, locked card previews replace skeletons.