# Fix: Build Post-Publish Flow — Analytics Access, Retention Hooks, Re-engagement

## Context
After a clip is rendered/published, the user is dropped back to Browse with no confirmation, no analytics link, no 'create another' prompt, and no follow-up email. This missing post-publish flow is responsible for: (1) Analytics never being visited despite being a stated user goal, (2) clips/user averaging only 1.5 (no second clip trigger), and (3) 0% month-over-month retention. The habit loop is completely broken.

## Requirements

### 1. Post-Publish Confirmation State
- After a clip is successfully published, show a confirmation modal or toast with:
  - ✅ `Clip published successfully!`
  - `View Analytics →` deep-link to that specific clip's analytics
  - `Create Another Clip →` button that opens the upload flow
  - Share link to the published clip
- Do NOT silently redirect back to Browse.

### 2. Analytics Page Independence
- Ensure `/analytics` loads independently and is not gated behind having published clips.
- If no clips exist yet, show an empty state: `No analytics yet — publish your first clip to start tracking performance.`
- Verify the `/analytics` route doesn't share data-fetching bugs with other pages.
- Add an E2E smoke test: navigate directly to `/analytics` — verify it renders without errors.

### 3. Retention Hooks (Dashboard)
- After a user creates their first clip, show a `Create next clip` CTA on the dashboard with a suggested template based on their last clip type.
- Add a simple streak/activity counter: `Clips this week: X` to encourage repeat usage.

### 4. Re-engagement Email (Backend)
- Implement a day-7 email trigger for users who rendered a clip but never published it.
- Subject: `Your clip is ready — publish it in 1 click`
- Include a deep link directly to the publish action for that clip.
- Also implement a day-3 email for users who signed up but never uploaded.

## Files to Investigate
- Clip publish/render completion handler (API route or server action)
- `/analytics` page component
- Dashboard layout for post-publish state
- Email/notification service (if any exists)
- Database: check if `published_at` timestamp exists on clips table