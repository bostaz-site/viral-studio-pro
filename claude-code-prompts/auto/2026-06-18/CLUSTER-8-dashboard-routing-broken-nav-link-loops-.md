# Fix: Dashboard Route, Clip Library, and Post-Login Flow

## Context
Six findings (63, 65, 66, 86, 87, 88) report that the Dashboard nav link loops back to /upload, there is no clip library or analytics view, the post-login landing page is a bare upload dropzone, and the upload pipeline shows no progress states. Users — especially power users publishing 50+ clips/month — are completely blocked from accessing their work.

## Requirements
1. **Fix Dashboard routing**:
   - Find the navigation component and the Dashboard link.
   - Ensure it routes to `/dashboard` (not `/upload`).
   - Check for JS routing bugs (e.g., `router.push` silently failing, catch-all route matching `/upload`).
   - Verify the `/dashboard` route exists in the router configuration. If not, create it.
2. **Build the /dashboard page** (if it doesn't exist):
   - **Clip Library**: Show all rendered clips as cards with thumbnails, title, render date, status (rendering/ready/published), and platform published to.
   - **Render Queue**: Show any clips currently being processed with progress indicators.
   - **Quick Stats**: Show clips rendered this period, clips published, and publish rate.
   - **New Clip CTA**: Prominent button to start a new clip (links to /upload or opens upload modal).
3. **Fix post-login redirect**:
   - After successful login, redirect to `/dashboard` (not `/upload`).
   - `/upload` should be accessible from the dashboard as a sub-step or modal, not the default landing page.
4. **Add upload progress states** (finding 86):
   - After file selection, show: uploading (with % progress bar), processing/rendering (with estimated time), complete (with preview + publish CTA).
   - If the pipeline silently fails, show an error toast with retry option within 10 seconds of no progress.
5. **Add a step indicator** on the upload page (finding 64):
   - Show: Upload → Edit → Render → Publish so users know what comes next.
6. **Navigation structure**:
   - Nav should have: Dashboard, New Clip (→ /upload), Analytics, Settings.
   - Active page should be highlighted in nav.

## Files to Investigate
- Navigation/header component — find the Dashboard link href.
- Router configuration (Next.js `app/` directory or `pages/` directory).
- Auth callback / login redirect logic.
- Upload page component — add progress states.
- Create `/dashboard` page component if missing.
- API endpoints for fetching user's clips, render statuses.