# Fix: Sidebar Plan/Quota Widget — Correct Data, Better Upgrade UX

## Context
The sidebar quota widget has two critical problems: (1) It initially renders a wrong plan state (showing free-tier `0/3` before flipping to `16/120` Studio) because it defaults to free-tier data before the real plan data resolves. This causes churn anxiety. (2) The upgrade CTA (`Upgrade to Pro — 30 clips/mo`) has no pricing, no feature comparison, and is missing entirely from key pages like `/upload`. Users who hit their limit — the highest-intent upgrade candidates — have no clear path to convert.

## Requirements

### 1. Fix Plan Data Race Condition
- Find the sidebar component that renders the quota widget.
- Do NOT render any plan-specific data (tier name, quota numbers, upgrade CTA) until the user's plan data has fully resolved from the API.
- While loading, show a small skeleton/shimmer in the quota area — never a default tier state.
- Verify the plan data fetch is happening once at the layout level and shared via context/store, not re-fetched per component.

### 2. Upgrade CTA Improvements
- Add the price directly to the sidebar CTA: `Upgrade to Pro — $19/mo · 30 clips`.
- When the user is at or near their plan limit (e.g., 3/3 on free), change the progress bar color to amber/red, change the label to `Limit reached`, and add a prominent `Upgrade ↗` link inline.
- On click of the upgrade CTA, open a modal (not a page redirect) with a side-by-side Free vs Pro comparison showing: price, clip count, clip length, features, and a primary `Upgrade Now` button.

### 3. Upgrade CTA on /upload Page
- Ensure the sidebar (or at minimum a slim upgrade banner) persists on the `/upload` page.
- When a limit-reached user navigates to `/upload`, auto-trigger the upgrade modal with contextual copy: `You've used all 3 free clips this month. Upgrade to Pro for 30 clips/mo.`

### 4. Correct Counter Display
- Free tier at limit: `3/3 clips used` (red bar, `Limit reached` label)
- Pro tier: `X/30 clips used`
- Studio tier: `X/120 clips used`
- Always pull from the authenticated user's actual subscription data.

## Files to Investigate
- Sidebar layout component (likely in `app/dashboard/layout.tsx` or a shared sidebar component)
- User plan/subscription context or store
- API route for user plan data
- `/upload` page layout
- Any billing/subscription utility functions