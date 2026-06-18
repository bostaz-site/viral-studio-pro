# Fix: Publish Flow Missing — No Path from Render to Distribution

## Context
A user rendered 24 clips but published 0. Investigation reveals the `publish-dialog` component returns null — the entire publish flow is dead code or was never implemented. There is no UI path from a rendered clip to publishing on TikTok, YouTube Shorts, or Instagram Reels. Without publishing, users never see social proof (views, likes) and have no reason to return. This is the #1 retention killer.

## Root Cause
The publish-dialog component is null/missing. The distribution page exists in navigation but has no functional publish surface.

## Requirements
1. **Implement a minimal publish-dialog component**:
   - Platform selector: checkboxes for YouTube Shorts, TikTok, Instagram Reels
   - Caption field: pre-populated from clip metadata/title
   - 'Publish Now' button (no scheduling needed for v1)
   - Download button as fallback ('Download & post manually')
2. **Auto-surface after render completes**: When a clip finishes rendering, show an inline CTA or modal: 'Your clip is ready — publish it now' with a direct link/button to open the publish-dialog with that clip pre-selected.
3. **Wire to distribution page**: The /distribution page should list all rendered clips with publish status and a 'Publish' action button on each.
4. **Re-engagement email**: Send a triggered email 24h after last render if no publish event occurred: 'Your [N] clips are ready — publish them now.' Link directly to distribution page.
5. **OAuth integrations** (can be v2): For v1, the 'Publish' action can simply download the clip and open the target platform in a new tab with instructions. True API publishing can come later.

## Files to investigate
- Search for `publish-dialog`, `PublishDialog`, `publish`, `distribution` in the codebase
- Render completion handler (where does the flow go after render finishes?)
- Distribution page component
- Email/notification system (search for `email`, `resend`, `notification`, `trigger`)

## Testing
- Render a clip → verify publish CTA appears immediately after render
- Click 'Publish' → verify publish-dialog opens with clip pre-selected
- Click 'Download & post manually' → verify clip downloads
- Verify distribution page shows all rendered clips with publish status
- Verify re-engagement email fires 24h after render with no publish
