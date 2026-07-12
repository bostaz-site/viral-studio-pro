# Fix: Build the Publish Dialog and Post-Render Publish Flow

## Context
The `publish-dialog` component is literally `null` — it was never built or was deleted. This means users who successfully render a clip hit a dead end with no way to publish. The stats confirm this: 3 clips rendered in 7 days, 0 published. The core retention loop is completely broken. Without publish, users have no reason to return.

## Requirements
1. **Build a minimal `publish-dialog` component** with:
   - Platform selector (dropdown or icon buttons): TikTok, YouTube Shorts, Instagram Reels, Twitter/X
   - Caption/description textarea (pre-filled with AI-generated suggestion if available)
   - Hashtag suggestions (optional but helpful)
   - `Post Now` primary CTA button
   - `Download Instead` secondary option
   - `Schedule for Later` tertiary option (can be disabled/coming-soon for MVP)
2. **Trigger the dialog automatically** after render completes — show a modal: `'Your clip is ready! Post it now.'` with the publish dialog contents. Do NOT require the user to find a publish button.
3. **Wire to distribution API**: Connect the `Post Now` button to the existing distribution API endpoints. If platform OAuth tokens are connected, publish directly. If not, prompt the user to connect the platform first.
4. **Add publish button to clip cards**: On the dashboard/clips list, each rendered clip should have a `Publish` button that opens this same dialog.
5. **Post-publish confirmation**: After successful publish, show a success state with a link to view the post and a CTA: `'Publish another clip'`.

## Files likely involved
- `components/publish-dialog.tsx` (create or replace the null export)
- Render completion handler/page (wherever the render-done state is shown)
- Distribution API service (`lib/api/distribution.ts`)
- Clip card component (add publish CTA)
- Connected accounts/OAuth flow (may need to verify this works)

## Acceptance Criteria
- After render completes, publish dialog appears automatically as a modal
- User can select a platform, write a caption, and click `Post Now`
- If platform is connected: clip is published and user sees confirmation
- If platform is not connected: user is prompted to connect via OAuth
- Publish button also available on clip cards in the dashboard
- `publish-dialog` export is no longer `null`
- At least one platform (TikTok or YouTube) works end-to-end