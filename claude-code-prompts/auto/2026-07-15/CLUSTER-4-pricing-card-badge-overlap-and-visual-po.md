# Fix: Pricing Card Badge Overlap

## Context
On the Pro pricing card, two badge pills (`Most Popular` and `Launch Price`) visually overlap each other and clip against the card boundary. This is reported 4 times across the audit and is purely a CSS layout issue, but it signals 'unpolished product' at the exact moment visitors are deciding whether to pay.

## Requirements
1. Find the Pro pricing card component in the landing page code.
2. Fix the badge layout using one of these approaches (pick the cleanest):
   - **Option A (preferred):** Merge into a single badge: `Most Popular · Launch Price`
   - **Option B:** Stack the two badges vertically with 4-8px gap between them
3. Ensure badges are fully contained within the card boundary with proper padding and z-index.
4. Test at viewport widths: 320px, 375px, 768px, 1024px, 1440px. Badges must not overlap or clip at any width.
5. The badges should use consistent styling (same height, font size, border-radius, background color).

## Files to Investigate
- `components/landing/pricing-section.tsx` (or similar)
- Any shared Badge/Pill component used for plan labels
- Tailwind/CSS classes on the Pro card's badge container