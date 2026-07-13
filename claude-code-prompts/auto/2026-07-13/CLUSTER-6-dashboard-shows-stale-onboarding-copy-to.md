# Fix: Dashboard Shows Stale Onboarding Copy to Returning Users

## Context
Findings 108 and 109 both flag that the dashboard hero reads 'Make Your First Viral Clip' even for users who have already created clips. This makes the product feel unaware of user state and wastes prime screen real estate.

## Requirements
1. Find the dashboard hero component (search for 'Make Your First Viral Clip' in `components/dashboard/` or `app/dashboard/`).
2. Add a conditional check based on the user's total clip count (this data should already be available from the same source as the quota widget).
3. Implement two states:
   - **First-time (0 clips):** Keep 'Make Your First Viral Clip' with the current beginner-oriented UI.
   - **Returning (1+ clips):** Switch to 'Make Your Next Viral Clip' or 'Welcome back — here are your recent clips'. Show a grid/list of their 3 most recent clips with thumbnails and basic stats (views if available, created date). Add a contextual upgrade hook if on Free plan: 'You're on a roll — go unlimited with Pro'.
4. If clip data is already fetched on the dashboard, reuse it. If not, query it.

## Files to Modify
- Dashboard hero component (search for 'First Viral Clip')
- Possibly the dashboard page data fetching logic

## Acceptance Criteria
- Users with 0 clips see 'Make Your First Viral Clip'.
- Users with 1+ clips see personalized copy and their recent clips.
- The returning-user state includes an upgrade nudge for free-plan users.
- No hardcoded 'First' text is shown to returning users.