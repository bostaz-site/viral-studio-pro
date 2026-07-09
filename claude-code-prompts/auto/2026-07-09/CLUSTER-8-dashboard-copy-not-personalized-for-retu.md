# Fix: Personalize Dashboard for Returning Users

## Context
3 findings (143, 145, 148) report that the dashboard always shows 'Make Your First Viral Clip' even for users who have already created clips. Additionally, a 'STUDIO' badge in the nav creates plan confusion for free-tier users. The dashboard doesn't adapt to user state.

## Task

### 1. Personalize the dashboard hero based on clip count
- Find the dashboard page component (likely `app/dashboard/page.tsx` or similar).
- Check the user's total clip count.
- Conditional rendering:
  - `0 clips`: Show `Make Your First Viral Clip` with onboarding-oriented UI (upload CTA, how-it-works steps).
  - `1-2 clips`: Show `Make Your Next Viral Clip` with recent clips grid and a `Create Another` CTA.
  - `3+ clips`: Show `Welcome back, [name]` (or just `Your Clips`) with recent clips, basic stats (total clips, this month's usage), and a contextual upgrade nudge if on free tier.

### 2. Fix the 'STUDIO' badge confusion
- Find the nav bar component.
- The 'STUDIO' text/badge next to the logo should NOT suggest a plan name if it's just the product name.
- If 'STUDIO' is the product tier name: only show it for users actually on the Studio plan.
- For free users: show `FREE` plan badge (or no plan badge) with a subtle `Upgrade` link.
- For Pro users: show `PRO` badge.
- Ensure the plan badge is driven by the user's actual subscription status from the same source of truth as the usage counter.

### 3. Show recent clips on the dashboard for returning users
- For users with 1+ clips, replace the onboarding hero with a grid/list of their most recent clips (thumbnail, title, date, score if available).
- Include a prominent `Create New Clip` button.

## Acceptance Criteria
- New users (0 clips) see onboarding copy.
- Returning users (1+ clips) see personalized copy and their recent clips.
- The nav badge reflects the user's actual plan (Free/Pro/Studio), not a static 'STUDIO' label.
- Dashboard adapts without a full page reload (client-side state is fine).