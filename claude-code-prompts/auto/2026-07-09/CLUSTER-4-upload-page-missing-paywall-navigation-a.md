# Fix: Upload Page — Add Paywall, Navigation, and Plan Context

## Context
4 findings (106, 107, 128, 141) identify that the `/upload` page strips the dashboard sidebar entirely, has no route guard for limit-hit users, no pricing link, and no plan context. A free user who has exhausted their 3 clips/month can navigate directly to `/upload` and see the full upload UI with no gate, no upgrade prompt, and no way to find pricing.

## Task

### 1. Add a server-side/middleware route guard on `/upload`
- In the Next.js middleware or the `/upload` page's server component, check the authenticated user's remaining clip quota for the current billing period.
- If `remainingClips <= 0`:
  - Do NOT render the upload UI.
  - Instead, render a full-page paywall/upgrade prompt (see step 3).
  - Alternatively, redirect to `/pricing?reason=clip_limit` or `/dashboard?upgrade=true`.

### 2. Restore navigation context on `/upload`
- Add back the dashboard sidebar OR at minimum a slim top-bar that includes:
  - Logo/home link
  - Navigation back to Dashboard
  - Current plan name and usage counter (e.g., `Free · 3/3 clips used`)
  - A prominent `Upgrade to Pro` button/link
- Ensure this navigation is always visible, not just when the user is at their limit.

### 3. Build the paywall/limit-reached state
- When the user is at their limit, the `/upload` page should show a dedicated blocked state:
  - Headline: `You've used all 3 free clips this month`
  - Subtext: `Upgrade to Pro for 30 clips/month, longer clips, and priority rendering`
  - Side-by-side Free vs Pro comparison (3 bullets each)
  - Pro price displayed clearly
  - Primary CTA: `Upgrade to Pro — $19/mo`
  - Secondary CTA: `Back to Dashboard`
- Include one line of social proof if available.

### 4. Add a soft plan context banner for users NOT at limit
- For free users who still have clips remaining, show a subtle top banner on `/upload`:
  - `Free plan · 2 clips remaining this month · Upgrade to Pro`
  - Non-intrusive, dismissible, but always visible.

## Acceptance Criteria
- Users with 0 remaining clips cannot access the upload form — they see a paywall.
- All users on `/upload` can navigate back to dashboard and to pricing.
- Plan name and usage counter are visible on the upload page.
- Upgrade CTA is always reachable from `/upload`.
- The paywall state includes price, benefits, and a clear CTA.