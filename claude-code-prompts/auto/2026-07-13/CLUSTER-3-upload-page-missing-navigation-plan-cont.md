# Fix: Upload Page Missing Navigation, Plan Context & Quota Info

## Context
The `/upload` page (`app/upload/page.tsx` or equivalent) uses a minimal layout that drops the dashboard sidebar, plan status, quota counter, and upgrade CTA. Findings 107, 130, 132, 135 all describe the same structural problem: users lose account context at the most critical conversion moment.

## Requirements
1. Find the upload page layout (likely `app/upload/layout.tsx` or `app/upload/page.tsx`).
2. Either:
   a. Wrap the upload page in the same dashboard layout that includes the sidebar, OR
   b. Add a persistent top bar component (`components/upload/upload-top-bar.tsx`) that displays:
      - Current plan name (e.g., 'Free Plan' or 'Pro')
      - Quota usage (e.g., '3/3 clips used this month')
      - An 'Upgrade to Pro' button/link (visible when on Free plan or at quota limit)
      - A link back to Dashboard
3. The quota data should come from the same source the dashboard sidebar uses (find the existing clips-used query/hook and reuse it).
4. When the user is at 100% quota, the top bar should show a prominent upgrade banner: 'You've used all your free clips this month. Upgrade to Pro for unlimited clips.' with a direct link to the pricing/checkout page.
5. Ensure the upload form itself remains the primary focus — the top bar should be compact (48-56px height).

## Files to Modify
- `app/upload/page.tsx` or `app/upload/layout.tsx`
- Create `components/upload/upload-top-bar.tsx`
- Reuse existing plan/quota hook (search for 'clips', 'usage', 'quota', 'subscription' in hooks/ or lib/)

## Acceptance Criteria
- Visiting `/upload` shows the user's plan name and clip quota.
- At 100% quota, a visible upgrade CTA is shown.
- Users can navigate back to Dashboard and to Settings/Pricing without backtracking.
- The upload form is still the primary visual element on the page.