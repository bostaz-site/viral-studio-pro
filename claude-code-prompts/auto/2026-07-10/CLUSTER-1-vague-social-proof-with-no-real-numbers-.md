# Fix: Replace Vague Social Proof with Real Numbers and Creator Evidence

## Context
The hero section at viralanimal.com contains the line 'Trusted by clippers and creators turning stream moments into TikTok hits' with zero supporting evidence — no user counts, no creator handles, no clip stats, no testimonials, no avatars. This appears in 7 separate audit findings. For skeptical visitors (the primary persona), vague social proof is worse than none.

## Requirements
1. Find the hero section component (likely in `components/landing/hero-section.tsx` or similar).
2. Replace the vague trust line with a concrete social proof bar containing:
   - A real or realistic stat line: e.g. `'4,200+ creators · 18M+ TikTok views generated'` — make these configurable constants in a `lib/constants.ts` or similar so they can be updated easily.
   - Add 3-5 small circular avatar placeholders (use placeholder images from `/public/avatars/` or create simple colored circle divs with initials) with a stacked/overlapping layout.
   - Optionally add a short quote snippet from a creator with their TikTok handle.
3. Style the social proof bar to sit directly below the hero CTA button, above the fold.
4. Ensure it's responsive — on mobile, stack the stat line above the avatars.
5. Use muted/secondary text colors so it supports the CTA without competing visually.

## Files likely involved
- `components/landing/hero-section.tsx` (or equivalent hero component)
- `lib/constants.ts` (create if needed, for social proof numbers)
- Any global CSS/Tailwind config for avatar styling

## Acceptance Criteria
- The vague 'Trusted by clippers and creators...' line is gone.
- A concrete stat with numbers is visible above the fold on both desktop and mobile.
- Avatar images or placeholders are rendered in an overlapping row.
- Stats are defined as constants in one place for easy future updates.