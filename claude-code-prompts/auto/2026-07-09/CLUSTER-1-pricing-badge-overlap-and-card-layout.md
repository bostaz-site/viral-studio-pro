# Fix: Pricing Badge Overlap and Card Layout

## Context
On the pricing section of the landing page, the Pro plan card displays two badges ('Most Popular' and 'Launch Price') that visually overlap each other. This looks broken and unprofessional at the exact moment users are making a purchase decision. There are 3 separate audit findings about this (IDs 100, 101, 138).

## Task
1. Find the pricing section component (likely in `components/landing/pricing-section.tsx` or similar).
2. Locate the Pro plan card configuration where badges/tags are rendered.
3. Fix the badge rendering so they do NOT overlap. Choose one of these approaches:
   - **Preferred**: Combine both badges into a single badge: `Most Popular · Launch Price` styled as one pill/chip.
   - **Alternative**: Stack them vertically with a `4px` gap, ensuring the card header has enough top padding to fully display both badges without clipping.
4. Ensure badges are properly positioned (anchored to the card top) and do not clip or overflow at viewport widths from 320px to 1440px.
5. Test that no other plan cards are affected by the layout change.

## Acceptance Criteria
- Badges on the Pro plan card are fully visible, readable, and do not overlap at any standard viewport width.
- No visual clipping or overflow on the card header.
- Other plan cards (Free, Studio) are unaffected.