# Fix: Vague / Missing Social Proof on Homepage

## Context
The homepage hero section at `viralanimal.com` displays 'Trusted by clippers and creators turning stream moments into TikTok hits' with no numbers, creator names, avatars, testimonials, or embedded output examples. Multiple audit findings (101, 120, 123, 124) flag this identical issue. This is the #1 credibility gap for skeptical visitors.

## Requirements
1. In `components/landing/hero-section.tsx` (or equivalent hero component), replace the generic 'Trusted by clippers and creators...' line with a dynamic social proof bar.
2. Create a `components/landing/social-proof-bar.tsx` component that:
   - Displays a real metric (e.g., 'X,XXX clips exported this month') pulled from an API endpoint or a static seed value that can be updated.
   - Shows 3-5 small circular avatar thumbnails (use placeholder images for now, add a TODO for real creator avatars).
   - Optionally shows a short quote snippet from a creator.
3. Create an API route `app/api/stats/clips-exported/route.ts` that returns a count of clips exported (query your DB, or for now return a reasonable seed number with a TODO to wire to real data).
4. Below or near the hero, add an embedded video showcase section (`components/landing/output-showcase.tsx`) that displays 2-3 looping short video examples of actual exported clips. Use `<video>` tags with `autoPlay`, `muted`, `loop`, `playsInline`. Use placeholder MP4s for now and add TODO comments for real outputs.
5. Ensure the social proof bar renders above the fold on both desktop and mobile.

## Files to Modify
- `components/landing/hero-section.tsx`
- Create `components/landing/social-proof-bar.tsx`
- Create `components/landing/output-showcase.tsx`
- Create `app/api/stats/clips-exported/route.ts`

## Acceptance Criteria
- The generic 'Trusted by clippers and creators' text is removed.
- A numeric stat and avatar row are visible in the hero section.
- A video showcase section exists with placeholder content.
- The page passes a visual check on mobile (375px) and desktop (1440px).