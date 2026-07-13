# Fix: 'Soon' Platforms Displayed as Live Features

## Context
The homepage has a 'Post To' platform strip (likely in `components/landing/` or inline in the landing page) that shows TikTok, YouTube, and Instagram logos. YouTube and Instagram are marked 'soon' but visually appear as if they're supported. This was flagged in findings 111, 112, 121, 122, 126, 129, 131 — all pointing to the same UI element.

## Requirements
1. Find the platform logos section on the homepage (search for 'soon', 'YouTube', 'Instagram' in `components/landing/` or `app/page.tsx`).
2. Remove YouTube and Instagram logos from the primary platform strip entirely.
3. Optionally, add a small secondary line below the TikTok logo: 'YouTube Shorts & Instagram Reels coming Q3 2025' in muted text — but only if a concrete date exists. If no date, omit entirely.
4. If there is a 'multi-platform distribution' claim in the pricing section or Studio tier description, qualify it with 'TikTok today, YouTube & Instagram coming soon' or remove the multi-platform language.
5. Search the entire codebase for any other references to YouTube/Instagram as supported platforms and ensure they are either removed or clearly marked as upcoming.

## Files to Modify
- `components/landing/platform-section.tsx` (or wherever the 'Post To' logos live)
- Pricing section component (search for 'multi-platform')
- Any other landing page components referencing YouTube/Instagram

## Acceptance Criteria
- The 'Post To' section shows only TikTok as a supported platform.
- No 'soon' badges appear in the platform strip.
- Pricing copy does not imply multi-platform support is live today.
- Grep for 'soon' in landing page components returns zero platform-related hits.