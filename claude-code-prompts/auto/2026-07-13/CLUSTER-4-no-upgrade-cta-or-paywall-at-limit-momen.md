# Fix: No Upgrade CTA or Paywall at Limit Moment

## Context
Findings 106, 118, and 134 describe a missing upgrade/upsell path at the most critical conversion moments: when the user is near or at their clip limit. There is no proactive warning before hitting the wall, no upgrade CTA on the dashboard or upload page, and no value pitch for Pro at the paywall moment.

## Requirements
1. **Proactive limit warning (Finding 106):**
   - In the dashboard layout component, check the user's remaining clip count.
   - When remaining clips ≤ 1, show a yellow inline banner at the top of the dashboard: 'You have {n} free clip left this month — Upgrade to Pro for unlimited clips.' with an 'Upgrade' button.
   - When remaining clips = 0, change to a red banner: 'You've used all your free clips. Upgrade to continue creating.'

2. **Persistent upgrade CTA (Finding 118):**
   - In the sidebar component (search for the plan badge / 'STUDIO' text), make the plan indicator clickable and link to the pricing page.
   - Below the clips counter in the sidebar, add a conditional 'Upgrade to Pro' button that appears when usage ≥ 80% or on Free plan.

3. **Paywall modal with Pro pitch (Finding 134):**
   - Create `components/modals/upgrade-modal.tsx`.
   - This modal should appear when a user at 0 remaining clips tries to upload.
   - Content: 3 bullet points of Pro benefits (unlimited clips, longer duration, priority rendering — pull from pricing data), the monthly price, and a single testimonial placeholder.
   - Two buttons: 'Upgrade Now' (links to checkout) and 'Maybe Later' (dismisses).
   - Trigger this modal in the upload flow when the user is at their limit.

4. Find the upload initiation handler (search for upload submit, `handleUpload`, or similar in `app/upload/`) and add a pre-check: if clips remaining === 0, show the upgrade modal instead of proceeding.

## Files to Modify/Create
- Dashboard layout component (banner injection)
- Sidebar component (clickable plan badge, upgrade button)
- Create `components/modals/upgrade-modal.tsx`
- Upload page/handler (pre-upload quota check)

## Acceptance Criteria
- A yellow warning banner appears on the dashboard when user has 1 clip remaining.
- A red banner appears when user has 0 clips remaining.
- The sidebar shows an 'Upgrade to Pro' button for free-plan users at ≥80% usage.
- Attempting to upload at 0 remaining clips shows a modal with Pro benefits and a checkout link.
- The plan badge in the sidebar is clickable and navigates to pricing.