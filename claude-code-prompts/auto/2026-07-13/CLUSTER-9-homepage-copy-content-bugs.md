# Fix: Homepage Copy & Content Bugs

## Context
Finding 115: FAQ section renders `&apos;` as literal text instead of apostrophes due to escaped HTML entities in JSX strings. Finding 117: Hero subtitle says 'Browse Twitch & Kick clips' which excludes non-streamer creators. Finding 116: No platform-intent data is collected, blocking personalization.

## Requirements
1. **Fix FAQ HTML entities (Finding 115):**
   - Open `components/landing/faq-section.tsx`.
   - Find-and-replace all `&apos;` and `&apos;` with regular apostrophes `'` or curly quotes `'`.
   - Also check for `&amp;`, `&quot;`, and any other escaped entities.
   - Verify by rendering the page that all FAQ text displays correctly.

2. **Reframe hero subtitle (Finding 117):**
   - Find the hero subtitle (search for 'Twitch & Kick' in `components/landing/hero-section.tsx`).
   - Change from 'Browse Twitch & Kick clips' to something output-focused: 'Turn any stream clip into a viral TikTok — supports Twitch & Kick' or 'AI-powered clips from Twitch, Kick & more → ready for TikTok'.

3. **Add platform-intent selector (Finding 116):**
   - This is a data collection feature. In the clip creation/upload flow, add an optional platform-intent selector: 'Where will you post this?' with options: TikTok, YouTube Shorts, Instagram Reels.
   - Store the selection in the clip/project record (add a `target_platform` field to the relevant database table/model).
   - Add a TODO to use this data for auto-setting aspect ratio and export defaults.
   - This is a schema change — create a migration if using Prisma/Drizzle: `ALTER TABLE clips ADD COLUMN target_platform TEXT DEFAULT 'tiktok'`.

## Files to Modify
- `components/landing/faq-section.tsx`
- `components/landing/hero-section.tsx`
- Upload/clip creation component
- Database schema (migration)

## Acceptance Criteria
- No `&apos;` or similar escaped entities render as visible text on the FAQ page.
- Hero subtitle references the output benefit, not just input sources.
- Upload flow includes an optional platform selector.
- Database schema includes a `target_platform` column.