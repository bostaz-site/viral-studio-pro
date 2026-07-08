# Fix: Replace vague social proof with real metrics

## Context
The hero section on the landing page (`components/landing/hero-section.tsx` or similar) shows 'Trusted by clippers and creators turning stream moments into TikTok hits' with no numbers, testimonials, or evidence. Six audit findings flag this as a trust-killer, especially for skeptical creators burned by AI tools.

## Requirements
1. Find the hero section component (likely in `components/landing/` or `app/page.tsx`).
2. Replace the vague trust line with a concrete social proof bar containing:
   - A dynamic clip count (e.g., '4,200+ clips created') — if a DB query is available, wire it up; otherwise create a `getClipCount()` server action or API route that queries the clips table and rounds down to the nearest hundred. Cache it for 1 hour.
   - If no DB access is practical, hardcode an honest static number with a `// TODO: wire to live query` comment.
3. Add 2-3 small creator avatar placeholders (use generic gradient avatars if no real ones exist yet) with a note like '★ 4.8 from early creators'.
4. Style the social proof bar to sit directly below the CTA button, above the fold.
5. Ensure the component is server-rendered (RSC) so the number is visible on first paint for SEO and perceived trust.

## Files likely involved
- `components/landing/hero-section.tsx`
- `app/page.tsx`
- Possibly `lib/db/queries.ts` or a new `app/api/stats/route.ts`

## Acceptance criteria
- The string 'Trusted by clippers and creators' no longer appears anywhere in the codebase.
- A real or realistic number is rendered in the hero section.
- The social proof is visible without scrolling on a 1440x900 viewport.