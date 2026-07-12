# Fix: Hero Before/After Demo Videos

## Context
The landing page hero section has a Before/After video comparison that is the #1 conversion driver — it should show a raw Twitch/gaming clip transformed into a polished 9:16 viral short. Currently, both panels render as solid black rectangles. Videos don't autoplay, there are no poster thumbnails, and the `Play demo` buttons either don't work or the video sources fail to load. This is the single highest-leverage fix for acquisition.

## Requirements
1. **Find the hero/demo section component** (likely `components/landing/hero-section.tsx` or similar). Identify the video elements and their source URLs.
2. **Fix video sources**: Verify the video files exist and are accessible. If they're hosted on a CDN, check the URLs. If they don't exist yet, create two short demo clips (5-10 seconds each):
   - Before: raw 16:9 gameplay clip, no edits
   - After: polished 9:16 vertical clip with captions, zoom, branding
3. **Implement autoplay**: Set videos to `autoplay`, `muted`, `loop`, `playsinline` so they play immediately without user interaction on all browsers (muted autoplay is allowed by all browsers).
4. **Add poster thumbnails**: Set a `poster` attribute on each `<video>` element with a static frame from the video. This ensures the container NEVER renders as a black box, even if the video fails to load.
5. **Remove opacity-60**: If there's an `opacity-60` class on the video containers or images, remove it immediately.
6. **Add error handling**: If the video fails to load (`onerror`), fall back to displaying the poster image as a static `<img>` element, or show an animated GIF version.
7. **Optimize loading**: Preload the video assets (`<link rel="preload">`), keep them small (<2MB each), use MP4 with H.264 for maximum compatibility.

## Files likely involved
- `components/landing/hero-section.tsx` (or `landing-hero.tsx`)
- Video assets in `public/` or CDN
- Any CSS/Tailwind classes with `opacity-60`

## Acceptance Criteria
- Both Before and After videos autoplay silently on page load
- Videos loop continuously
- Poster thumbnails visible within 100ms of page load (before video buffers)
- No black boxes under any circumstance (slow connection, blocked video, JS disabled)
- Works on Chrome, Safari, Firefox, mobile Safari, Chrome Android
- `opacity-60` removed — videos are fully visible
- Total video payload < 4MB combined