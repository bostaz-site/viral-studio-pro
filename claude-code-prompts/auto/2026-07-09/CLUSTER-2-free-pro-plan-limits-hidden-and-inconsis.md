# Fix: Surface Plan Limits Early and Standardize Terminology

## Context
Multiple audit findings (102, 103, 111, 112, 113, 132, 142) identify that:
1. The hero CTA says 'Start Free — No Card Required' with zero mention of the 3 clips/month or 60s duration cap, creating a bait-and-switch feeling.
2. The pricing cards use 'clips' for Free and 'videos' for Pro inconsistently.
3. The 2-minute Pro clip cap is never mentioned outside pricing.
4. The Studio plan's '90 + 30 bonus' breakdown is confusing vs just saying '120 clips/month'.

## Task

### 1. Standardize terminology across all pricing cards
- Open the pricing section component (likely `components/landing/pricing-section.tsx`).
- Replace ALL instances of 'videos' with 'clips' across Free, Pro, and Studio plan configs.
- Studio plan: change '120 videos/month (90 + 30 bonus)' to simply '120 clips/month'.
- Ensure the unit noun is 'clips' everywhere — cards, tooltips, CTAs.

### 2. Surface limits in the hero section
- Find the hero section component.
- Add a one-liner directly beneath the primary CTA button: `Free plan: 3 clips/month · up to 60s · No card needed` in a muted/secondary text style.
- This sets expectations before sign-up.

### 3. Add clip-length context in the features section
- In the features/how-it-works section, add a brief note near the relevant feature: e.g., 'Free clips up to 60s — perfect for highlight moments. Pro unlocks up to 2 min for full reactions.'
- Frame the 2-min Pro cap as a feature (sweet spot for TikTok/Shorts), not a hidden limitation.

### 4. Fix Studio plan value proposition copy
- Change the Studio card to lead with a value-anchored headline like '4× the clips' or add a 'Best Value' badge.
- Remove the confusing '90 + 30 bonus' parenthetical.

### 5. Add a tooltip on Free plan clip limit
- On the Free plan card's '60s max' line, add a small info icon with a tooltip: 'Ideal for highlight moments and quick reactions.'

## Acceptance Criteria
- The word 'videos' does not appear on any pricing card — only 'clips'.
- Hero section shows plan limits inline beneath the CTA.
- Features section mentions clip duration limits with positive framing.
- Studio plan copy is clear and not confusing.
- All changes are responsive and render correctly at 320px–1440px.