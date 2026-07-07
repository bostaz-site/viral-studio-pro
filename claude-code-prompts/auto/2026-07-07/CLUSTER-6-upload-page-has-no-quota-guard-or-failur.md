# Fix: Add Quota Guard and Upload Phase Labels

## Context
The upload page has two related problems: (1) it's accessible with no quota check, so users at their limit see a full upload UI that will silently fail (finding 116), and (2) the upload progress bar tracks raw byte progress with no phase labels, causing the bar to appear frozen during signing/confirming steps (finding 103). Both stem from the upload flow lacking state awareness.

## Task
### Quota Guard (Finding 116)
1. Add a middleware or server-side check on the `/upload` route that verifies the user's remaining clip quota.
2. If quota is 0 (or user is unauthenticated), redirect to `/pricing?reason=clip_limit`.
3. On the pricing page, detect the `reason=clip_limit` query param and show a contextual message: 'You've reached your free plan limit — here's what Pro unlocks.'
4. If quota is low but not zero (e.g., last clip remaining), allow access but show a warning banner: 'You have 1 clip remaining this month.'

### Upload Phase Labels (Finding 103)
5. Find the upload handler (likely in `upload/` directory or a client component — search for `uploadProgress`).
6. Add an `uploadPhase` state with values: `'preparing' | 'uploading' | 'confirming' | 'done' | 'error'`.
7. Update the phase at each stage of the upload process:
   - Before presigned URL fetch: `'preparing'`
   - During actual file upload: `'uploading'`
   - After upload, during server confirmation: `'confirming'`
   - On success: `'done'`
   - On any error: `'error'`
8. Render a label above the progress bar that reflects the current phase: 'Preparing upload…' → 'Uploading (42%)…' → 'Finalizing…' → 'Done!'
9. During the `'confirming'` phase, switch the progress bar to an indeterminate/pulsing animation so it doesn't appear stuck at 100%.

## Acceptance Criteria
- Users at 0 remaining quota are redirected to pricing with contextual message
- Users with low quota see a warning banner on `/upload`
- Upload progress bar shows phase labels that change through the upload lifecycle
- Bar shows indeterminate animation during confirming phase
- Error phase shows retry option