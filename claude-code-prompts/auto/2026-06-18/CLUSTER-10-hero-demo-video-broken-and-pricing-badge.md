# Fix: Landing Page — Hero Demo Video and Pricing Badge Layout

## Context
Findings 60 and 62 report the hero phone mockup shows a completely black screen (demo video not playing/loaded). Finding 61 reports 'Most Popular' and 'Launch Price' badges overlap illegibly on the pricing card. These are the two highest-impact conversion elements on the page.

## Requirements
1. **Fix hero demo video**:
   - Find the hero section component (likely on the homepage `/` or `index` page).
   - The phone mockup should contain an autoplaying, muted, looping MP4 video showing a real before/after clip transformation.
   - Add a `poster` image attribute so there is NEVER a black screen during load.
   - Ensure the video element has: `autoplay`, `muted`, `loop`, `playsinline` attributes.
   - If no demo video asset exists, create a placeholder: use a screen recording of the product rendering a clip (before → after), export as MP4, compress to <2MB for fast load.
   - Lazy-load the video but ensure the poster shows immediately on first paint.
   - Test on mobile Safari (autoplay restrictions) and Chrome.
2. **Fix pricing badge overlap**:
   - Find the pricing section component.
   - The 'Most Popular' and 'Launch Price' badges are visually colliding on the Pro card.
   - Fix: Stack badges vertically with 4-8px gap, OR show only one primary badge per card (e.g., 'Most Popular' as the primary badge, 'Launch Price' as smaller text below the price).
   - Ensure badges have proper `z-index`, `position`, and don't overlap at viewport widths from 320px to 1440px.
   - Test at mobile (375px), tablet (768px), and desktop (1280px) breakpoints.
3. Write visual regression tests or at minimum manually verify at 3 viewport widths.

## Files to Investigate
- Homepage/landing page component (e.g., `index.tsx`, `landing.tsx`, `page.tsx`).
- Hero section component.
- Pricing section component.
- Public assets folder for video/poster files.
- CSS/Tailwind classes for badge positioning.