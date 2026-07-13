# Fix: Pricing Section Polish & Clarity Issues

## Context
Findings 105/125 flag overlapping 'Most Popular' and 'Launch Price' badges on the Pro card. Finding 110 flags that free plan limits (3 clips/mo, 60s) are hidden from the hero CTA. Finding 127 flags that '60s clips' vs '2 min clips' is ambiguous (source vs export duration?).

## Requirements
1. **Fix badge overlap (Findings 105, 125):**
   - Find the Pro pricing card component (search for 'Most Popular', 'Launch Price' in `components/landing/pricing-section.tsx` or similar).
   - Merge the two badges into a single badge: 'Most Popular · Launch Price' or stack them vertically inside the card header with proper spacing (e.g., `flex flex-col gap-1` with `absolute` positioning adjusted).
   - Ensure the badge(s) don't clip outside the card boundary.

2. **Surface free plan limits in hero (Finding 110):**
   - Find the hero CTA (search for 'Start Free', 'No Card Required' in `components/landing/hero-section.tsx`).
   - Add a one-liner below the CTA button: 'Free includes 3 clips/month · Upgrade anytime' in muted/small text.

3. **Clarify clip duration limits (Finding 127):**
   - In the pricing cards, change 'Clips up to 60s' to 'Exported clips up to 60s (the TikTok sweet spot)' or add a tooltip/parenthetical: '(exported clip duration)'.
   - Similarly clarify Pro's '2 min' limit.

## Files to Modify
- `components/landing/pricing-section.tsx` (or equivalent)
- `components/landing/hero-section.tsx` (or equivalent)

## Acceptance Criteria
- Pro card badges do not visually overlap or clip outside the card.
- The hero CTA area includes a one-liner about free plan limits.
- Clip duration limits in pricing are labeled as 'exported clip duration'.
- Visual check passes on mobile (375px) and desktop (1440px).