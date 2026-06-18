# Fix: Ship publish flow — build publish-dialog, platform connect, and post-render CTA

## Context
The `publish-dialog` component is `null`. No social platforms are connected (`platform_breakdown` is empty). 24 clips were rendered but 0 published. Retention is 0%. The entire product value chain is severed at distribution. This is the #1 retention fix.

## Files to modify
- `src/components/PublishDialog.tsx` — create this component
- `src/components/PlatformConnect.tsx` — create OAuth connect component
- `src/pages/distribution.tsx` (or equivalent) — the distribution hub page
- `src/render/pipeline.ts` — add post-render hook to trigger publish prompt
- `src/api/publish/route.ts` — publish API endpoint
- `src/api/platforms/connect/route.ts` — OAuth connect endpoints
- `src/hooks/usePlatforms.ts` — platform state management
- Email templates directory — create re-engagement email template

## Steps
1. **Build `<PublishDialog />`**: A modal triggered after render completion (and accessible from clip cards). Contains:
   - Platform selector: checkboxes for TikTok, Instagram Reels, YouTube Shorts (only connected platforms enabled, others show 'Connect' button)
   - Caption/title field: pre-populated from clip metadata/hook text
   - 'Publish Now' primary CTA button
   - 'Schedule for later' secondary option (can be a stub in v1)
   - 'Copy link' fallback for manual posting
2. **Build `<PlatformConnect />`**: OAuth connection component with buttons for TikTok, Instagram, YouTube. Store tokens server-side. Show connection status (green checkmark when connected).
3. **Post-render trigger**: After render completes, auto-open the PublishDialog. If no platform is connected, show PlatformConnect inline within the dialog: 'Connect a platform to publish in 1 click'.
4. **Distribution hub**: On the distribution page, show all rendered clips with status (draft/published/scheduled). Each clip card has a 'Publish' button that opens PublishDialog.
5. **Re-engagement email**: Set up a triggered email (via Resend/Postmark) that fires 24h after a render if the clip hasn't been published: 'Your clip is ready — publish it now in 1 click.' Deep-link to the distribution page with the clip pre-selected.
6. **Fix spam_risk handling** (finding 130): When TikTok returns `spam_risk`, show a 'Pending Review' status instead of 'Success'. Log the event.
7. **Test**: Assert PublishDialog renders with platform selector. Assert clicking 'Publish Now' calls the publish API. Assert post-render hook triggers the dialog. Assert empty platform state shows connect prompt.

## Definition of Done
- PublishDialog component exists and is functional
- Users can connect at least one social platform via OAuth
- Post-render flow automatically prompts publish
- Distribution hub shows all clips with publish status
- Re-engagement email fires 24h after unpublished render
- TikTok spam_risk shows 'Pending Review' not 'Success'
- 0→1 published clips possible within one session

## Commit message
```
feat(publish): ship publish dialog, platform OAuth connect, and post-render publish prompt
```