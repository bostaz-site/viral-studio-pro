# Fix: Free Tier Paywall / Limit Gate Missing on Upload Page

## Context
Free-tier users get 3 clips/month. When they've used all 3 and visit /upload, the page looks identical to a fresh account — no indication they're at their limit, no upgrade prompt, no disabled state. Users either waste time trying to upload (and hit a silent failure) or leave confused. This is the single most important conversion moment and it's completely missing. 6 separate audit findings flag this.

## Root Cause
The /upload page does not query the user's usage quota on page load and has no conditional rendering for the limit-exhausted state.

## Requirements
1. **Server-side quota check on /upload load**: When a logged-in free-tier user loads /upload, query their current month's clip usage count. Return it to the client.
2. **Hard paywall state when at limit**: If `clips_used >= clips_limit`, replace the upload dropzone with a paywall component:
   - Show usage: '3/3 free clips used this month'
   - List Pro benefits (unlimited clips, HD export, etc.)
   - Primary CTA: 'Upgrade to Pro' button linking to /pricing or opening a Stripe checkout
   - Disable/hide the file picker entirely — do not let users interact with the upload UI
3. **Full-screen modal or inline replacement**: Either a modal overlay on the dropzone or a full inline replacement. Do NOT use a subtle banner that can be ignored.
4. **Block file selection**: The 'Select file' button must be disabled or removed. Do not allow users to pick a file only to fail silently downstream.

## Files to investigate
- Upload page component (search for `/upload`, `UploadPage`, `dropzone`, `SelectFile`)
- User quota/usage API (search for `quota`, `usage`, `clips_used`, `free_tier`, `limit`)
- Subscription/plan logic (search for `plan`, `subscription`, `tier`, `pro`)

## Testing
- Log in as a free user with 3/3 clips used → /upload should show paywall, not dropzone
- Log in as a free user with 0/3 clips used → /upload should show normal dropzone
- Log in as a Pro user → /upload should show normal dropzone regardless of count
- Click 'Upgrade to Pro' → should navigate to pricing or open checkout
