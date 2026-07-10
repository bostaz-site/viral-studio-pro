# Fix: Pricing Card Badge Overlap Layout Bug

## Context
3 findings flag the same visual bug: on the Pro pricing card, 'Most Popular' and 'Launch Price' badge pills overlap each other and clip at the top of the card. This looks like a rendering bug and undermines trust at the exact payment decision point.

## Requirements
1. Find the pricing section component (likely `components/landing/pricing-section.tsx`).
2. Locate the Pro card's badge rendering logic.
3. Fix the layout using one of these approaches:
   - **Option A (preferred):** Merge into a single badge: `'Most Popular · Launch Price'`
   - **Option B:** Stack badges vertically with `flex-col gap-1` inside the card header area.
4. Ensure badges are fully contained within the card boundary — add sufficient `pt-` (padding-top) to the card if badges are absolutely positioned.
5. Set proper `z-index` so badges render above the card background but below any modals.
6. Test at mobile, tablet, and desktop breakpoints to confirm no clipping.

## Files likely involved
- `components/landing/pricing-section.tsx`
- Associated CSS/Tailwind classes for badge positioning

## Acceptance Criteria
- No visual overlap between badge pills on the Pro card.
- Badges are fully visible within the card boundary at all breakpoints.
- The pricing section looks polished and trustworthy.