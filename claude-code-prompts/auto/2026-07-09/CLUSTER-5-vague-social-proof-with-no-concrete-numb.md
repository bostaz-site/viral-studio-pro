# Fix: Replace Vague Social Proof with Concrete Numbers

## Context
3 findings (119, 121, 133) flag that the hero section says 'Trusted by clippers and creators turning stream moments into TikTok hits' with zero supporting evidence — no numbers, no testimonials, no logos. For skeptical users evaluating an AI tool, an unsubstantiated trust claim actively backfires.

## Task

### 1. Replace the tagline with a concrete metric
- Find the hero section component.
- Replace `Trusted by clippers and creators turning stream moments into TikTok hits` with a data-backed line. Options:
  - `X,XXX clips created this month` (pull from DB or hardcode a realistic seed number)
  - `Trusted by X,XXX+ creators` (if you have user count)
  - `X clips created · Y creators joined this week`
- If pulling a live count, create a simple API route `/api/stats/public` that returns `{ clipsCreated: number, creatorsCount: number }` and cache it for 1 hour.
- If live data isn't ready yet, hardcode a realistic number and add a `TODO` to wire it to a live query.

### 2. Add visual social proof elements
- Below the hero CTA, add a row of 3–5 overlapping avatar circles (use placeholder avatar images or real creator avatars if available) with text like `Join 2,400+ creators`.
- Alternatively, add 2–3 short testimonial snippets with TikTok handles beneath the CTA area.

### 3. Ensure the social proof is visible in the first viewport
- The metric/avatars must be visible without scrolling on desktop (1440px) and within the first scroll on mobile (375px).

## Acceptance Criteria
- The vague 'Trusted by clippers and creators' line is replaced with a specific number.
- At least one visual trust element (avatars, testimonials, or a stat counter) is visible near the hero CTA.
- The social proof renders correctly on mobile and desktop.