# Fix: Make dashboard state-aware for returning users

## Context
Three findings flag that the dashboard shows stale onboarding copy ('Make Your First Viral Clip') to returning users who already have clips, and the 'STUDIO' nav badge confuses plan-tier perception. The root cause is zero conditional rendering based on user state.

## Requirements

### 1. Conditional dashboard hero
Find the dashboard hero/welcome component:
- If user has 0 clips: show 'Make Your First Viral Clip' with onboarding steps.
- If user has 1-5 clips: show 'Make Your Next Viral Clip' with their recent clips and a 'Keep going!' message.
- If user has 5+ clips: show 'Your Clips' with stats (total clips, most recent) and an upgrade nudge if on free tier.
- The clip count should come from whatever data source populates the dashboard (likely a server component query or API call).

### 2. Plan badge in nav
Find the 'STUDIO' badge in the navigation bar:
- Make the badge reflect the user's ACTUAL plan tier: Free users see 'FREE' (or no badge), Pro users see 'PRO', Studio users see 'STUDIO'.
- For free users, add a small 'Upgrade' link/button next to the badge.
- Ensure the plan tier is read from the same auth/session/subscription source of truth.

## Files likely involved
- `components/dashboard/hero.tsx` or `app/dashboard/page.tsx`
- `components/nav/navbar.tsx` or `components/layout/sidebar.tsx`
- `lib/auth/session.ts` or wherever user plan data is accessed

## Acceptance criteria
- A user with ≥1 clips never sees 'Make Your First Viral Clip'.
- The nav badge accurately reflects the user's current plan tier.
- Free-tier users see a visible upgrade path in the nav.