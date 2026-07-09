# Fix: Upgrade CTA — Add Pricing, Comparison, and Contextual Urgency

## Context
6 findings (116, 117, 127, 129, 130, 131) identify that the upgrade path in the dashboard is anemic: a small sidebar link says 'Upgrade to Pro — 30 clips/mo' with no price, no feature comparison, no social proof, and no proactive warnings as users approach their limit. High-intent users at or near their clip cap have no information to make a purchase decision.

## Task

### 1. Enhance the sidebar upgrade widget
- Find the sidebar component (likely in `components/dashboard/sidebar.tsx` or similar).
- Update the upgrade CTA to include the price: `Upgrade to Pro — $19/mo · 30 clips`.
- Make it a button (not a text link) with primary/accent styling.

### 2. Add usage threshold warnings
- The usage counter already shows `X/Y clips this month`. Add color-coded states:
  - `< 70%` usage: default/neutral color
  - `70-89%` usage: yellow/warning color with text `Running low`
  - `90-99%` usage: orange with text `Almost at limit — Upgrade to Pro`
  - `100%` usage: red with text `Limit reached` and the upgrade button becomes prominent
- Show projected end-of-month usage for power users if possible (compare current pace to days remaining).

### 3. Build an upgrade modal triggered at limit
- When a user at their clip limit attempts to upload or create a new clip, trigger a modal (not a redirect). The modal should contain:
  - Headline: `You've used all your free clips this month`
  - Side-by-side comparison table: Free vs Pro (clips/month, clip length, features)
  - Price: `$19/month` clearly displayed
  - 3 bullet points of Pro benefits
  - One line of social proof (e.g., `Join 2,400+ creators on Pro`)
  - Primary CTA: `Upgrade to Pro`
  - Secondary: `Maybe later` (dismiss)
- This modal should also be accessible by clicking the sidebar upgrade widget.

### 4. Add a proactive nudge at last free clip
- When the user is on their final free clip (e.g., 3/3 or 2/3), show a non-blocking inline banner at the top of the dashboard:
  - `Last free clip remaining this month — Upgrade to Pro for unlimited clips`
  - Dismissible but re-appears on next page load.

### 5. Add a tooltip to the usage counter
- On hover/click of the `X/Y clips` counter, show a tooltip: `Each rendered clip uses 1 credit. Resets on [date].`

## Acceptance Criteria
- Sidebar upgrade CTA shows the Pro plan price.
- Usage counter changes color at 70%, 90%, and 100% thresholds.
- An upgrade modal with pricing, comparison, and social proof appears when a limit-hit user tries to create/upload.
- A proactive banner appears when the user is on their last free clip.
- Usage counter has a tooltip explaining what counts as a clip credit.