# Fix: Add dashboard layout shell and plan context to /upload page

## Context
The /upload page uses a minimal standalone layout instead of the dashboard shell. Users who navigate here (especially when at their free plan limit) lose all account context: no sidebar navigation, no plan/quota indicator, no upgrade CTA. Five audit findings trace to this single architectural gap. The upload page needs to be wrapped in the same layout as the rest of the dashboard.

## Files to modify
- `app/upload/page.tsx` (or wherever the upload route is defined)
- The dashboard layout component (likely `app/dashboard/layout.tsx` or `components/dashboard/sidebar.tsx`)
- Possibly move the upload page under the dashboard route group so it inherits the layout automatically

## Requirements
1. **Wrap /upload in the dashboard layout** — it should show the same sidebar navigation as /dashboard, /enhance, /analytics, etc. If this means moving the route to `app/dashboard/upload/page.tsx`, do that and add a redirect from `/upload` → `/dashboard/upload`.
2. **Add a plan status banner** at the top of the upload area: `Free plan · {clips_used}/{free_limit} clips used this month · [Upgrade to Pro]`. Pull `clips_used` and plan info from the same source the dashboard uses.
3. **When at limit**, show a prominent inline banner or modal: 'You've used all 3 free clips this month. Upgrade to Pro for unlimited clips.' with a primary Upgrade CTA and a secondary 'Back to Dashboard' link.
4. **Ensure the sidebar** highlights the current nav item (Upload) so wayfinding is clear.
5. **Keep the upload form functional** — don't break the existing upload UI; just wrap it in proper layout context.

## Validation
- Navigate to /upload directly (simulating a bookmark) — sidebar and plan status should be visible
- With a free account at limit, confirm the limit banner appears with working Upgrade link
- Confirm sidebar navigation works to jump to Settings, Analytics, etc. without going through Dashboard first
- Test on mobile to ensure sidebar collapses appropriately