# Fix: Upload Flow Lacks Phase Labels and Error Recovery

## Context
Finding 103 flags that the upload progress bar shows 0-100% with no phase labels, so users see it 'stall' at 100% during the server confirmation step. Finding 133 flags that skeleton loaders on the dashboard display indefinitely with no timeout or error state. Finding 100 flags redundant format info clutter on the upload page. These all stem from insufficient upload UX feedback.

## Requirements
1. **Upload phase labels (Finding 103):**
   - Find the upload handler (search for `uploadProgress`, `presigned`, `upload` in `app/upload/` or `components/upload/`).
   - Add a `uploadPhase` state: `'preparing' | 'uploading' | 'confirming' | 'done' | 'error'`
   - Render a label above or beside the progress bar that changes:
     - `preparing` → 'Preparing upload…'
     - `uploading` → `Uploading (${percent}%)…`
     - `confirming` → 'Finalizing… almost done'
     - `done` → '✓ Upload complete! Your clip is being processed.'
     - `error` → 'Upload failed. [Retry]'
   - Set phase transitions at the appropriate points in the upload flow (before presigned URL fetch, during XHR/fetch upload, after upload completion API call).

2. **Timeout and retry for skeleton loaders (Finding 133):**
   - Find the dashboard clip grid component (search for skeleton, loading state in `components/dashboard/`).
   - Add a timeout: after 8 seconds of loading with no data, replace skeletons with an inline error banner: 'Couldn't load your clips. [Retry]' with a retry button that re-fetches.
   - Log the timeout event (add a TODO for Sentry/error tracking integration if not present).

3. **Remove redundant format info (Finding 100):**
   - On `/upload`, find the duplicate format info line (the one outside the drop zone, likely a footer or helper text below it).
   - Remove the duplicate. Keep format info only inside the drop zone.

## Files to Modify
- Upload page/component (phase state, progress label, duplicate format text)
- Dashboard clip grid component (timeout + error state for skeletons)

## Acceptance Criteria
- The upload progress bar shows a text label that changes through 4 phases.
- After upload completes, a success message with estimated processing time is shown.
- On upload error, a retry button is displayed.
- Dashboard skeletons are replaced with an error + retry UI after 8 seconds.
- The upload page shows file format info in only one location.