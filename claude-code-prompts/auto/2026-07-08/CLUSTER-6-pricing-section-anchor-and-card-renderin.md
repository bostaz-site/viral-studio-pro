# Fix: Pricing section anchor, badge overlap, and copy clarity

## Context
Four findings target the pricing section: the nav anchor scrolls to the wrong position (FAQ instead of pricing heading), the 'Most Popular' and 'Launch Price' badges visually overlap on the Pro card, the Studio plan's '90 + 30 bonus' copy is confusing, and free-plan clip length limits aren't mentioned until pricing (bait-and-switch feel).

## Requirements

### 1. Fix pricing anchor
Find the pricing section component (`components/landing/pricing-section.tsx` or similar):
- Ensure the `id` attribute used as the scroll target (e.g., `id="pricing"`) is on the section wrapper or heading element, NOT on an element below the FAQ.
- Add `scroll-margin-top: 80px` (or equivalent for your sticky nav height) to the pricing section so the heading 'Pick Your Plan, Start Clipping' is the first visible element when the anchor is activated.
- Test by clicking the 'Pricing' nav link — the heading must be at the top of the viewport.

### 2. Fix badge overlap on Pro card
Find the pricing card component:
- If both 'Most Popular' and 'Launch Price' badges exist on the same card, stack them vertically with 4-8px gap, OR combine into a single badge: 'Most Popular · Launch Price'.
- Add `padding-top` to the card to ensure badges don't clip outside the card boundary.

### 3. Clarify Studio plan copy
- Change '120 videos/month (90 + 30 bonus)' to simply '120 videos/month'.
- Consider adding a value-anchor line: 'Just $0.20/clip' or '4x more clips than Pro'.

### 4. Surface clip length limits earlier
- In the hero or feature section (before pricing), add a brief note: 'Free: clips up to 60s · Pro & Studio: up to 2 min'.
- This sets expectations before the user reaches pricing.

## Files likely involved
- `components/landing/pricing-section.tsx`
- `components/landing/pricing-card.tsx`
- `components/landing/hero-section.tsx` or feature section
- CSS/Tailwind classes on pricing section

## Acceptance criteria
- Clicking 'Pricing' in nav scrolls to show the 'Pick Your Plan' heading at top of viewport.
- No badge overlap or clipping on any pricing card at 320px-1440px viewport widths.
- Studio plan copy says '120 videos/month' without the confusing bonus breakdown.
- Clip length limits are mentioned somewhere above the pricing section.