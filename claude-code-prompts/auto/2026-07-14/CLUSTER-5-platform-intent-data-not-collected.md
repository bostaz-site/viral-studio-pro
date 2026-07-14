# Fix: Add platform-intent selector and store platform breakdown data

## Context
The `stats.platform_breakdown` field is empty — the product never asks users which platform they're creating for. This blocks export setting personalization (aspect ratio, duration limits, caption styles) and makes it impossible to prioritize platform integrations based on actual user demand.

## Files to modify
- Upload/project creation flow (likely `app/upload/page.tsx` or `app/dashboard/upload/page.tsx`)
- API route handling clip/project creation (to persist the selection)
- Database schema if `platform_breakdown` needs a corresponding per-clip field
- Stats aggregation logic (wherever `stats.platform_breakdown` is computed)

## Requirements
1. **Add a platform selector** at the start of the upload/project creation flow:
   - Radio buttons or pill toggles: 'TikTok' | 'YouTube Shorts' | 'Instagram Reels'
   - Default to TikTok (since it's the only live publishing integration)
   - Make it required but not a blocker — if skipped, default to TikTok
2. **Store the selection** on the clip/project record in the database (e.g., `target_platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels'`)
3. **Auto-set export defaults** based on selection:
   - TikTok: 9:16, up to 60s (free) / 2min (pro)
   - YouTube Shorts: 9:16, up to 60s
   - Instagram Reels: 9:16, up to 90s
   - (These can be simple config mappings for now)
4. **Aggregate to stats.platform_breakdown**: Update the stats computation to count clips by `target_platform` and populate the previously empty `platform_breakdown` object: `{ tiktok: 45, youtube_shorts: 12, instagram_reels: 8 }`
5. **Use in publish dialog**: If a publish/export dialog exists, default the platform selection to what the user chose at creation time

## Validation
- Create a new clip — platform selector is visible and defaults to TikTok
- Select YouTube Shorts — confirm export settings adjust (aspect ratio, duration)
- Check the database — `target_platform` field is populated on the clip record
- Check stats endpoint/admin — `platform_breakdown` is no longer empty
- Existing clips without `target_platform` don't break (default to 'tiktok' or 'unknown')