# Fix: Add Concrete Social Proof to Homepage

## Context
The homepage says 'Trusted by clippers and creators' but shows zero evidence — no numbers, names, testimonials, or stats (findings 102, 109, 111). This is a single copy problem: the trust line in the hero section is empty marketing. For skeptical users evaluating AI tools, vague trust signals are worse than no trust signals.

## Task
1. Find the hero section component (likely `components/landing/hero-section.tsx` or similar) that renders the 'Trusted by clippers and creators' text.
2. Replace the static trust line with a dynamic social proof component that accepts props:
   - `clipCount: number` (total clips created on platform)
   - `creatorCount: number` (total users who have created at least 1 clip)
   - `testimonials: Array<{ quote: string, handle: string, platform: string }>` (optional)
3. Render the social proof as: '{creatorCount}+ creators · {clipCount} clips posted to TikTok' with a subtle animated counter effect.
4. For now, hardcode reasonable seed values if no API exists (e.g., pull from database count or use conservative real numbers). Add a `// TODO: wire to real-time stats API` comment.
5. Below the stats line, add space for 2-3 short testimonial cards (even if placeholder for now — create the component structure with a `testimonials` prop).
6. Ensure the social proof is visible above the fold on both desktop and mobile.

## Acceptance Criteria
- The generic 'Trusted by...' line is replaced with at least one concrete number
- Testimonial component structure exists and renders when testimonials array is non-empty
- Copy feels specific and verifiable, not vague