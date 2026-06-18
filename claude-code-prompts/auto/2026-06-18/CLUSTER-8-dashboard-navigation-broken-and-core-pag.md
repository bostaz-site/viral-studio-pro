# Fix: Wire dashboard navigation and build core authenticated pages

## Context
The 'Dashboard' nav link either does nothing or loops back to /upload. There are no accessible pages for clip history, render queue, analytics, or settings. Power users paying $79/mo have a single upload dropzone as their entire interface. This is a churn trigger for any user past their first session.

## Files to modify
- `src/app/dashboard/page.tsx` — create dashboard page
- `src/app/analytics/page.tsx` — create analytics page (can be stub)
- `src/components/Navigation.tsx` or `src/components/Navbar.tsx` — fix routing, add nav items
- `src/components/ClipLibrary.tsx` — create recent clips component
- `src/app/layout.tsx` — ensure nav is consistent across authenticated routes

## Steps
1. **Fix Dashboard route**: Ensure the 'Dashboard' nav link routes to `/dashboard` (not `/upload`). Check for: wrong `href`, SPA routing bug swallowing navigation, or the link pointing to the current page.
2. **Build `/dashboard` page**: Show:
   - Recent clips (last 10) with thumbnail, status (rendering/ready/published), and quick actions (publish, re-render, download)
   - Render queue: any in-progress jobs with status and ETA
   - Quick stats: clips this month, publish rate, total views (if available)
   - Upload shortcut CTA
3. **Add nav items**: Update the navigation bar to include: `Dashboard`, `My Clips`, `Analytics`, `Upload`. For free users, also show `Upgrade to Pro`.
4. **Upload progress**: On /upload, after file selection, show an inline progress bar (upload %, then render status with ETA). Add a 'notify me' option. Persist render jobs to the dashboard so users can navigate away.
5. **Analytics stub**: Create `/analytics` page with a placeholder: 'Analytics coming soon — connect a platform to start tracking.' This unblocks navigation even if full analytics isn't ready.
6. **Test**: Assert clicking 'Dashboard' from /upload navigates to /dashboard. Assert /dashboard renders recent clips. Assert nav contains all expected links.

## Definition of Done
- Dashboard link navigates to a functional /dashboard page
- Dashboard shows recent clips, render status, and quick stats
- Nav bar contains: Dashboard, My Clips, Analytics, Upload, (Upgrade)
- Upload page shows progress after file selection
- All routes are accessible and don't loop back to /upload

## Commit message
```
feat(app): build dashboard page, fix nav routing, add clip library and render status
```