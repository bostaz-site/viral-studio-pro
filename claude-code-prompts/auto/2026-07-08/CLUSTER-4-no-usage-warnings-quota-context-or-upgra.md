# Fix: Add quota warnings, threshold alerts, and contextual upgrade prompts

## Context
Eight audit findings converge on the same root cause: the clip quota system tracks usage but provides no warnings as users approach limits, no explanation of what counts as a clip, and no upgrade CTA anywhere in the dashboard or upload flow. Users hit a hard wall with no conversion opportunity. This is the single highest-impact cluster for revenue.

## Requirements

### 1. Quota widget improvements (Dashboard sidebar)
Find the usage widget component (renders '16/120 clips this month'):
- Add color-coded states: **green** (0-79%), **yellow** (80-94%), **red** (95-100%).
- Add a tooltip on hover/click explaining: 'Each rendered clip counts toward your monthly quota. Resets on [billing date].'
- At ≥80% usage, show inline text: 'Running low — [Upgrade for more](/pricing)'.
- At 100%, change the widget to a prominent upgrade CTA.

### 2. Pre-upload gate (Upload page)
In the upload page or its route middleware:
- Check remaining quota before rendering the upload UI.
- If quota = 0, show a blocking modal/banner: 'You've used all X clips this month. Upgrade to [Plan] for Y clips/month — $Z/mo.' Include 3 bullet points of Pro benefits.
- If quota = 1, show a yellow banner: 'Last clip on your plan this month — [Upgrade for unlimited](/pricing)'.
- If quota > 1, show a subtle top banner: 'Free plan · X/Y clips remaining · [See plans](/pricing)'.

### 3. Upgrade prompt content
Create a reusable `<UpgradePrompt variant='inline' | 'modal' | 'banner' />` component that shows:
- Plan name and price (pull from a shared pricing config)
- 3 key Pro benefits (e.g., 'Unlimited clips', '2-min clip length', 'Priority rendering')
- A single testimonial line or creator stat placeholder
- CTA button linking to `/pricing` or triggering Stripe checkout

## Files likely involved
- `components/dashboard/usage-widget.tsx` or sidebar component
- `app/upload/page.tsx` or `middleware.ts`
- New: `components/shared/upgrade-prompt.tsx`
- `lib/config/pricing.ts` or wherever plan details are defined

## Acceptance criteria
- Usage widget changes color at 80% and 95% thresholds.
- Tooltip on quota widget explains what counts as a clip.
- `/upload` page shows a contextual upgrade message when quota ≤ 1.
- `/upload` page blocks upload UI and shows upgrade modal when quota = 0.
- A reusable `<UpgradePrompt>` component exists and is used in both locations.