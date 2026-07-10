# Fix: Upload Page Missing Navigation, Plan Context, and Upgrade Path

## Context
9 findings converge on the /upload page being completely disconnected from the dashboard experience. It drops the sidebar, shows no plan status, has no clip counter, no upgrade CTA, and duplicates file format info. When a user hits their free-tier limit — the highest-intent upgrade moment — there's no pricing info, no feature comparison, and no way to convert without navigating away.

## Requirements
1. **Restore navigation context on /upload:**
   - Find the upload page layout (likely `app/upload/layout.tsx` or `app/upload/page.tsx`).
   - Either keep the full dashboard sidebar on /upload, or add a slim top bar that includes: user avatar, plan name, clips used/remaining, and an 'Upgrade' button.
   - Remove the orphaned 'Dashboard' text link in the top-right.

2. **Add plan status banner:**
   - At the top of the upload page, show a contextual banner: `'Free plan · 2/3 clips used this month'` or `'Free plan · Limit reached — Upgrade to Pro'`
   - Pull usage data from the same source as the dashboard sidebar widget.

3. **Add paywall/upgrade prompt when limit is reached:**
   - When a free user at 3/3 clips visits /upload, show an upgrade modal or inline prompt instead of (or overlaying) the upload drop zone.
   - Include: Pro plan price ($19/mo), 3 key benefits (unlimited clips, longer clips, analytics), and one social proof line.
   - Include a direct 'Upgrade Now' button linking to checkout.

4. **Add proactive last-clip warning:**
   - When user has 1 clip remaining, show a yellow inline banner: 'Last free clip this month — Upgrade to Pro for unlimited.'
   - Show this on both /dashboard and /upload.

5. **Fix duplicate file format info:**
   - Remove the duplicate format line from the footer area below the drop zone.
   - Replace it with the plan status hint: `'Free plan · 3/3 clips used — Upgrade to Pro for unlimited uploads.'`

6. **Add upload progress phase labels:**
   - Find the upload progress state (likely `uploadProgress` in the upload client component).
   - Add a `uploadPhase` state: `'preparing' | 'uploading' | 'confirming' | 'done'`
   - Render a label above the progress bar that changes with each phase: 'Preparing upload…' → 'Uploading (42%)…' → 'Finalizing…' → 'Done!'

## Files likely involved
- `app/upload/page.tsx` and/or `app/upload/layout.tsx`
- Upload client component (search for `uploadProgress`)
- `components/dashboard/sidebar.tsx` (to extract plan status as a reusable component)
- `components/upgrade-prompt.tsx` (create new component)
- `lib/plans.ts` for plan quota constants

## Acceptance Criteria
- /upload page has persistent navigation (sidebar or top bar) with plan status.
- Users at their clip limit see an upgrade prompt with pricing and benefits.
- Users with 1 clip remaining see a proactive yellow warning banner.
- Duplicate file format text is removed.
- Upload progress shows phase labels, not just a percentage bar.
- All plan/usage data comes from the same source of truth as the dashboard.