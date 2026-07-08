# Fix: Add route guard for /upload based on quota

## Context
Finding 124 flags that `/upload` is accessible even when a user has 0 remaining clips, leading to silent failures. This is now partially addressed by the quota cluster's upload-page banner, but the route itself needs a proper server-side guard.

**Note:** This fix complements the quota warning cluster. The quota cluster adds UI banners; this fix adds the server-side redirect as the hard gate.

## Requirements
1. In Next.js middleware (`middleware.ts`) or as a server-side check in `app/upload/page.tsx`:
   - Verify the user is authenticated. If not, redirect to `/login?redirect=/upload`.
   - Query the user's remaining clip quota.
   - If quota = 0, redirect to `/pricing?reason=clip_limit`.
2. On `/pricing`, detect the `reason=clip_limit` query param and show a contextual banner: 'You've used all your clips this month. Upgrade to keep creating.'
3. Ensure the redirect is server-side (not client-side) to avoid flash of upload UI.

## Files likely involved
- `middleware.ts` or `app/upload/page.tsx` (server component check)
- `app/pricing/page.tsx` (to handle `reason` param)
- `lib/auth/` and `lib/db/queries.ts` for session and quota lookup

## Acceptance criteria
- Unauthenticated users hitting `/upload` are redirected to `/login`.
- Authenticated users with 0 quota are redirected to `/pricing?reason=clip_limit`.
- The pricing page shows a contextual message when `reason=clip_limit` is present.
- No flash of upload UI before redirect.