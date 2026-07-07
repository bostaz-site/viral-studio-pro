# Fix: Personalize Dashboard Hero for Returning Users

## Context
The dashboard hero always says 'Make Your First Viral Clip' even for users who have already created clips (findings 107, 114). This is a simple conditional copy problem — the component doesn't check user clip count before rendering.

## Task
1. Find the dashboard hero/welcome component (search for 'Make Your First Viral Clip' or 'First Viral' in `components/dashboard/` or the dashboard page file).
2. Access the user's clip count (this should already be available since the usage counter shows it — find the same data source).
3. Implement conditional rendering:
   - **0 clips**: Keep current copy: 'Make Your First Viral Clip' with onboarding CTA
   - **1-5 clips**: 'Make Your Next Viral Clip' with a link to recent clips and a 'You've made {n} clips so far!' stat
   - **6+ clips**: 'Welcome back! You've created {n} clips this month' with recent clip thumbnails and an upgrade nudge if on free tier ('You're on a roll — go unlimited with Pro')
4. For returning users (1+ clips), replace the beginner clip picker with a grid of their 3 most recent clips with view counts (if available) or creation dates.
5. Ensure the conditional logic handles edge cases: new billing cycle with 0 clips but historical usage should still show returning-user state (check total lifetime clips, not just current month).

## Acceptance Criteria
- Users with 0 lifetime clips see onboarding hero
- Users with 1+ lifetime clips see personalized returning-user hero
- Recent clips are displayed for returning users
- Upgrade nudge appears for free-tier returning users