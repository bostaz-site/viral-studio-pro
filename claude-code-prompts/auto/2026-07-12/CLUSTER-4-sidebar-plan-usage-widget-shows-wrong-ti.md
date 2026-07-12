# Fix: Sidebar Plan/Usage Widget Accuracy

## Context
The sidebar usage widget has three distinct bugs:
1. **Wrong plan tier**: Studio ($79/mo) users see `0/3 Clips this month` with an `Upgrade to Pro` CTA — their plan is not being detected.
2. **Wrong clip count**: Some users see `16/120` when they should see `3/3` (or vice versa) — the counter doesn't reflect actual usage.
3. **No limit visibility**: The dashboard has no ambient warning when a user approaches or hits their limit — no color change, no banner, no inline upgrade nudge.

The root cause is that the sidebar component is not correctly reading the authenticated user's subscription tier and real-time clip usage from the database/billing system.

## Requirements
1. **Fix the plan lookup**: Trace the sidebar component and find where it gets the user's plan tier and clip limit. Ensure it reads from the canonical source (Supabase `subscriptions` table synced via Stripe webhooks, or equivalent). Map each plan to its correct limit: Free=3, Pro=30, Studio=120.
2. **Fix the usage counter**: Ensure `clips_used` is queried in real-time (or near-real-time) from the clips table filtered by the current billing period. Do not cache or hardcode this value.
3. **Suppress upgrade CTA for paid users**: If the user is on Pro or Studio, do NOT show `Upgrade to Pro`. Show `Upgrade to Studio` for Pro users, or nothing for Studio users. Consider showing plan name instead: `Studio Plan · 16/120 clips`.
4. **Add visual limit states**:
   - At 66%+ usage: amber/yellow progress bar
   - At 100% usage: red progress bar + `'Limit reached'` text + inline `Upgrade` link
   - For free tier at limit: prominent upgrade nudge
5. **Add the usage widget to the dashboard header** as well (not just sidebar) so it's visible on all viewport sizes.

## Files likely involved
- Sidebar component (`components/sidebar.tsx` or `components/layout/sidebar.tsx`)
- Usage widget subcomponent
- Subscription/plan service (`lib/subscription.ts`, `hooks/useSubscription.ts`)
- Supabase queries for clip count and subscription tier
- Stripe webhook handler (verify it correctly syncs plan tier)

## Acceptance Criteria
- Free user at limit sees `3/3` in red with upgrade CTA
- Pro user sees `X/30` with correct count
- Studio user sees `X/120` with correct count, NO upgrade CTA
- Usage bar changes color at 66% and 100%
- Counter updates within 30 seconds of a new clip being created
- Stripe subscription tier changes are reflected in the widget within 1 minute