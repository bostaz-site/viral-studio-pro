# Fix: Hero demo video, before/after examples, and pricing UI on landing page

## Context
The hero phone mockup shows a black screen — the single most important trust element on the page is dead. There are no real before/after clip examples anywhere. The pricing section has overlapping badges and the anchor scrolls to the wrong position. Free plan limitations are buried.

## Files to modify
- `src/app/page.tsx` or `src/pages/index.tsx` — the landing page
- `src/components/HeroDemo.tsx` — the phone mockup component
- `src/components/PricingSection.tsx` — pricing cards
- `public/` — add demo video assets
- CSS/Tailwind for pricing badge layout

## Steps
1. **Fix hero demo video**:
   - Check the `<video>` or `<source>` element in the phone mockup — the `src` is likely missing, broken, or the video file doesn't exist in `public/`.
   - Add a real demo MP4 (15-20 second loop showing a raw clip → Viral Animal output transformation). Set `autoPlay muted loop playsInline` attributes.
   - Add a `poster` attribute with a static thumbnail so the frame is never black, even while loading.
   - Ensure the video loads eagerly (not lazy-loaded) since it's above the fold.
2. **Add before/after examples**: Below the hero or in the features section, embed 2-3 side-by-side or toggle comparisons showing raw Twitch footage vs. the rendered vertical clip with captions, zoom, and branding. Use actual exported clips.
3. **Fix pricing badge overlap**: On the Pro card, the 'Most Popular' and 'Launch Price' badges overlap. Fix by: stacking them vertically with `flex-col gap-2`, or showing only 'Most Popular' (higher priority). Ensure badges render within card boundaries at all viewport widths.
4. **Fix pricing anchor**: The 'Pricing' nav link scrolls to the wrong position (mid-FAQ). Update the anchor `id` to point to the section heading ('Pick Your Plan'), not an FAQ item above it. Add `scroll-margin-top` to account for fixed nav height.
5. **Surface free plan limits**: Add a subtitle under the hero CTA: 'Free plan: 3 clips/month, up to 60s · No card needed'. On the free plan card, move the '60s clip limit' to the first or second bullet.
6. **Test**: Assert hero video element has a valid `src` and `poster`. Assert pricing section scroll anchor lands on the section title. Assert no badge elements overlap (visual regression test or DOM position check).

## Definition of Done
- Hero phone mockup autoplays a real demo video (never shows black)
- 2-3 before/after clip examples visible on landing page
- Pricing badges don't overlap
- Pricing nav anchor scrolls to section heading
- Free plan limits visible near hero CTA

## Commit message
```
fix(landing): fix hero demo video, add before/after examples, fix pricing badges and anchor
```