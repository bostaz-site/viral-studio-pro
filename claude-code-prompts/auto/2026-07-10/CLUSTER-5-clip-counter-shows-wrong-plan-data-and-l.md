# Fix: Clip Counter Wrong Plan Data + Missing Urgency States

## Context
5 findings converge on the same root cause: the dashboard sidebar usage widget shows incorrect plan quota data (e.g., '16/120' for a free user who should see '3/3'), has no visual warning states, and the 'STUDIO' nav badge creates plan confusion. The counter is purely informational with no upgrade path.

## Requirements
1. Find the sidebar usage widget component (likely in `components/dashboard/sidebar.tsx` or similar).
2. **Fix data source:** Ensure the clips counter reads from the authenticated user's actual plan tier. Free = 3 clips/mo, Pro = 30, Studio = 120. The quota and usage count must come from the same source of truth as the billing/plan system.
3. **Add warning states:**
   - 0-79% usage: default/green progress bar
   - 80-94% usage: yellow/amber progress bar + tooltip 'Approaching limit'
   - 95-99% usage: red progress bar + tooltip 'Almost at limit'
   - 100% usage: red progress bar + label changes to 'Limit reached' + inline 'Upgrade ↗' link
4. **Add upgrade CTA:** When at 100%, show a small 'Upgrade to Pro →' hyperlink directly in the widget, linking to `/pricing` or opening a checkout modal.
5. **Fix STUDIO badge:** Find the nav badge (likely in a layout or header component). Ensure it reflects the user's actual plan: free users see 'FREE' or no badge, paid users see their plan name. Search for 'STUDIO' string in the codebase.
6. **Add billing cycle context:** Show 'X days left in cycle' as a tooltip on the progress bar.

## Files likely involved
- `components/dashboard/sidebar.tsx` (usage widget)
- `components/dashboard/nav.tsx` or `components/layout/header.tsx` (STUDIO badge)
- `lib/plans.ts` or `lib/subscription.ts` (plan quota constants)
- API route or server component that fetches user plan data

## Acceptance Criteria
- Free users see '3/3' (or their actual usage out of 3), not '16/120'.
- Progress bar changes color at 80% and 95% thresholds.
- At 100%, label says 'Limit reached' with an 'Upgrade' link.
- Nav badge reflects actual user plan, not hardcoded 'STUDIO'.
- All plan-state UI elements read from one source of truth.