# Fix: Add upload phase labels and skeleton error fallback

## Context
Two findings flag missing UX states: (1) the upload progress bar tracks raw byte progress but doesn't label the 3 async phases (preparing → uploading → finalizing), causing perceived freezes at 100%, and (2) dashboard skeleton cards never show an error or retry state on data fetch failure.

## Requirements

### 1. Upload phase labels
Find the upload progress logic (likely `app/upload/` or `components/upload/`):
- Add a `uploadPhase` state: `'preparing' | 'uploading' | 'confirming' | 'done' | 'error'`.
- Render a text label above or below the progress bar that reflects the current phase:
  - `preparing` → 'Preparing upload…'
  - `uploading` → 'Uploading (42%)…' (with actual percentage)
  - `confirming` → 'Finalizing…' (progress bar at 100%, maybe add a subtle pulse animation)
  - `done` → '✓ Upload complete!' (green)
  - `error` → 'Upload failed — [Retry]' (red, with retry button)
- Update the phase state at each transition point in the upload flow (pre-sign, PUT/POST, confirm API call).

### 2. Dashboard skeleton error fallback
Find the clip grid/browse component on the dashboard:
- Add a timeout (e.g., 8 seconds) after which skeleton cards are replaced with an error state.
- Error state should show: 'Couldn't load clips — [Retry]' button and a brief message.
- Distinguish between 'no clips found' (empty state with CTA to create first clip) and 'fetch failed' (error state with retry).

## Files likely involved
- `app/upload/page.tsx` or `components/upload/upload-form.tsx`
- `components/dashboard/clip-grid.tsx` or similar
- Upload API route handlers

## Acceptance criteria
- During upload, a text label changes to reflect each phase.
- Progress bar never appears stuck at 100% — the 'Finalizing…' label explains the wait.
- Dashboard skeletons resolve to an error state with retry after 8s of failed fetch.
- Empty state ('No clips yet') is visually distinct from error state.