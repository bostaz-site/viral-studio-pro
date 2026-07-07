# Fix: Surface Upgrade Path in Dashboard and Upload Flows

## Context
Neither the dashboard nor the upload page shows any pricing, plan comparison, or upgrade CTA (findings 108, 117). Users who hit limits or want to evaluate Pro have zero conversion path in their current flow — they'd have to manually navigate to a pricing page.

## Task
1. Create a reusable `<UpgradeBanner />` component that accepts the user's current plan and usage data. It should render:
   - Current plan name and key limits (e.g., 'Free plan · 3 clips/month')
   - One-line Pro value prop (e.g., 'Upgrade to Pro: 30 clips/month, all export formats, priority rendering')
   - A 'See Plans' or 'Upgrade' button linking to `/pricing` (or triggering a pricing modal)
2. Add this banner to the **upload page** (`/upload`) — render it as a slim, non-intrusive top banner for free-tier users.
3. Add this banner to the **dashboard** — render it in the sidebar below the usage widget, or as a dismissable card in the main content area.
4. Create a `<PlanComparisonMini />` component showing a 2-column Free vs Pro comparison (3-4 key features) that can be embedded inline. Use this in the upgrade banner's expanded/hover state or as a tooltip.
5. Ensure the banner only shows for free-tier users (check plan status from auth/user context).
6. Add the Pro plan price prominently: '$19/mo' or equivalent.

## Acceptance Criteria
- Free-tier users see a non-aggressive upgrade banner on `/upload` and `/dashboard`
- Banner shows current plan, Pro price, and key upgrade benefits
- 'See Plans' button links to pricing page
- Paid users do not see the upgrade banner