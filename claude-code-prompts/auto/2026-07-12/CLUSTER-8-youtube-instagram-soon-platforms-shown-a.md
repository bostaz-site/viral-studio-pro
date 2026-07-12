# Fix: YouTube/Instagram 'Soon' Platforms Shown as Live

## Context
10 audit findings (110, 111, 115, 119, 134, 136, 142, 143, 147, 149) all flag the same issue: the homepage 'Post To' section shows TikTok, YouTube, and Instagram logos side-by-side, with YouTube and Instagram marked 'soon' in small grey text. This makes the product look incomplete and reads as vaporware padding.

## Requirements
1. **Find the platform logos section** — likely in `components/landing/platforms-section.tsx` or within the hero/features area.
2. **Remove YouTube and Instagram logos entirely from the main 'Post To' visual strip.** Only show TikTok as the shipped, working destination.
3. **Add a clearly separated 'Roadmap' or 'Coming Soon' line** below the main platform strip (or in a separate lightweight section). Style it as secondary/muted text: 'YouTube Shorts & Instagram Reels support coming Q3 2025' (or whatever the real timeline is). This should be visually distinct from current features — smaller font, muted color, clearly not part of the active feature set.
4. **Audit the Studio pricing card** for any 'multi-platform distribution' copy that implies YouTube/Instagram are live. If present, change to 'TikTok distribution (YouTube & Instagram coming soon)' or remove entirely.
5. If there's a `platforms` config array driving this section, add an `isLive: boolean` flag and filter the main strip to `isLive === true` only.

## Acceptance Criteria
- The main platform strip only shows TikTok.
- No 'soon' badges appear inline with live features.
- A separate, clearly secondary line mentions the roadmap platforms with a target date.
- Pricing card copy does not imply multi-platform distribution is live today.