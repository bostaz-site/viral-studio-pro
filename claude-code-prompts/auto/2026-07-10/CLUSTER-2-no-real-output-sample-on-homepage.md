# Fix: Replace Static Mockup with Real Autoplaying Video Output Sample

## Context
The 'After — Viral Animal' panel in the features/before-after section shows a phone-frame wireframe with placeholder text ('Stream Clip', 'Subway Surfers'), not an actual exported clip. Finding [100] and [144] both flag this. Visitors can't judge quality without seeing real output, which is the #1 conversion factor.

## Requirements
1. Locate the before/after comparison component (likely in `components/landing/features-section.tsx` or a dedicated comparison component).
2. Replace the static mockup image/SVG in the 'After' panel with an autoplaying, muted, looping `<video>` element.
3. The video should be a real 9:16 TikTok-format clip (or the best sample available). Place the video file at `/public/samples/demo-output.mp4` (if no real clip exists yet, add a TODO comment and use any short vertical video as a placeholder, but wire up the video player correctly).
4. Wrap the video in a phone-frame CSS treatment (rounded corners, device bezel) to maintain the visual design.
5. Use `autoPlay`, `muted`, `loop`, `playsInline` attributes for cross-browser autoplay.
6. Add a lazy-loading strategy: use `loading='lazy'` or Intersection Observer so the video only loads when scrolled into view.
7. Optionally add 2-3 additional sample clips near the hero as a mini-gallery row showing variety of outputs.

## Files likely involved
- `components/landing/features-section.tsx` (or before-after comparison component)
- `/public/samples/` directory (create and add demo video)

## Acceptance Criteria
- The 'After' panel plays a real video, not a static image.
- Video autoplays muted and loops on both desktop and mobile.
- Phone-frame visual treatment is preserved.
- Page load performance is not degraded (lazy load the video).