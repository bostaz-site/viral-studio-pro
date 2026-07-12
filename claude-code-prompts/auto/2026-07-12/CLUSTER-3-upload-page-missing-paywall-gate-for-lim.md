# Fix: Upload Page Paywall Gate for Limit-Exceeded Users

## Context
The `/upload` page renders a fully functional upload UI (drop zone, file selector, URL import) even when the authenticated user has exhausted their free-tier clip limit (3/3). There is no gate, no banner, no disabled state, no upgrade CTA. Users waste time selecting files only to hit a silent failure. This is the single most important monetization moment and it's completely missing.

## Requirements
1. **Server-side check on page load**: In the `/upload` page's server component (or via middleware), fetch the user's current clip count and plan limit. If `clips_used >= plan_limit`, do NOT render the upload form.
2. **Paywall UI**: When the user is at/over their limit, render a **paywall card** that replaces (or overlays with blur) the upload form:
   - Show current usage: `'You've used 3/3 free clips this month'`
   - Show Pro value prop: `'Upgrade to Pro for 30 clips/mo, AI captions, priority processing'`
   - Primary CTA button: `'Upgrade to Pro'` → link to `/pricing` or Stripe checkout
   - Secondary: `'Resets [date]'` or `'Remind me next month'`
3. **Disable upload controls**: The drop zone, file selector, and URL import must be either removed from the DOM or visually disabled (greyed out) and non-interactive.
4. **Persistent upgrade banner for approaching-limit users**: For users at 2/3 clips, show a warning banner at the top of the upload page: `'1 free clip remaining — Upgrade for unlimited uploads'`.
5. **Also add an upgrade CTA on the upload page for ALL free-tier users** even if not at limit — a subtle banner or footer that mentions the Pro plan.

## Files likely involved
- `app/upload/page.tsx` and/or `app/upload/client.tsx`
- User quota/subscription service (`lib/subscription.ts`, `hooks/useSubscription.ts`)
- A new `PaywallGate` or `UpgradeBanner` component
- Pricing/checkout page route

## Acceptance Criteria
- Free user at 3/3 clips sees paywall card immediately on `/upload` — cannot interact with upload form
- Free user at 2/3 clips sees a warning banner but can still upload
- Upgrade CTA links to working checkout flow
- Upload form only renders for users with remaining quota
- Server-side enforced — not just a client-side hide (users can't bypass by disabling JS)