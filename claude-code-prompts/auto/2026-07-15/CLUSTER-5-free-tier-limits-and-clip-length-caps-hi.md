# Fix: Surface Free Tier Limits and Clip Length Caps Before Pricing

## Context
The homepage hero says `Start Free — No Card Required` and implies processing full 3h47 streams into viral clips. But the free plan is actually 3 clips/month capped at 60 seconds, and Pro caps at 2 minutes. Users only discover this in the pricing section, creating a bait-and-switch feeling. This is reported 6 times. The fix is about expectation-setting, not changing limits.

## Requirements

### 1. Hero Section
- Add a one-liner directly below the hero CTA button: `Free plan: 3 clips/month · up to 60s · No card needed`
- This sets expectations before signup so users aren't surprised at pricing.

### 2. Pricing Section — Clip Length Clarity
- Add a tooltip or parenthetical next to `Clips up to 60s` and `Clips up to 2 min` clarifying: `(exported clip duration)` or `(output TikTok length)`.
- Add a small note under the Pro clip length: `2 min is the TikTok sweet spot for engagement` — reframe the limit as intentional, not restrictive.
- Add a note explaining what happens if the source is longer: e.g., `AI auto-selects the best 2-min moment from your stream`.

### 3. Hero Subheadline
- If the hero currently says something like `full 3h47 stream → viral clip`, add a qualifier: `full 3h47 stream → best 2-min viral clip` so the output length expectation is set immediately.

### 4. Free vs Pro Comparison
- In the pricing cards, ensure the clip length row has a help icon/tooltip so users understand it's about output duration, not input duration.

## Files to Investigate
- `components/landing/hero-section.tsx` (or equivalent)
- `components/landing/pricing-section.tsx`
- Any feature comparison component