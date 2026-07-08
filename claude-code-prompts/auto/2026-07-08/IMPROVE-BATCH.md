# Implement Conversion Improvements: Upload Paywall & Pricing Visibility

## Context

You are working on **viralanimal.com**, a video editing SaaS for creators. The app is built as a Next.js project. Users have a Free plan (clips up to 60s) and a Pro plan (clips up to 2min, unlimited uploads, AI captions, split-screen, 4K export, priority processing, scheduling, analytics, distribution).

The core conversion problem: users hit upload limits but have **zero visibility into what Pro costs, what they get, or how to upgrade** — at the exact moment they're most likely to convert. They close the tab instead of upgrading.

Before making any changes, explore the codebase to locate the relevant files. Likely candidates:
- Upload page: `app/upload/page.tsx` or `pages/upload.tsx` (or similar)
- Paywall modal/component: search for files containing "paywall", "limit", "quota", "upgrade" in `components/` or `app/`
- Pricing page: `app/pricing/page.tsx` or `pages/pricing.tsx`
- Dashboard: `app/dashboard/page.tsx` or `pages/dashboard.tsx`
- Free/Pro plan constants or config: search for files containing plan limits, e.g. `lib/plans.ts`, `config/plans.ts`, or similar
- Layout/header for upload page

Run these searches to orient yourself before touching any file:
```
grep -r "paywall\|upload limit\|clip limit\|free plan\|upgrade" --include="*.tsx" --include="*.ts" -l
grep -r "60s\|60 sec\|clips up to" --include="*.tsx" --include="*.ts" -l
grep -r "Dashboard" app/upload --include="*.tsx" -l
```

---

## Changes to Implement

### Improvement 1 & 3 — Paywall modal: inline Pro pitch with price, features, and CTA

**File(s):** Whichever component renders the upload-blocked state (paywall modal/overlay). If it doesn't exist, create `components/UpgradePaywallModal.tsx` and wire it into the upload page.

**Requirements:**
- The modal/overlay must display inline (no redirect required to get this information):
  - Pro plan monthly price (use the real price from your pricing config; if unavailable, use a `PRO_PRICE_MONTHLY` constant you define, e.g. `$19/mo`)
  - A short Pro feature list: `Unlimited clips · Clips up to 2 min · AI captions · Split-screen · 4K export · Priority processing`
  - A primary **"Upgrade Now"** CTA button that links to `/pricing` or the checkout flow
  - A secondary **"See all plans →"** text link below the CTA
- Do NOT remove the existing paywall trigger logic — only augment the UI content shown inside it
- The modal should be self-contained: a user must be able to make the upgrade decision from this single screen without navigating away first

Example structure to add inside the existing modal (adapt to match codebase style):

```tsx
{/* Pro pitch — inline so user never needs to leave */}
<div className="upgrade-pitch">
  <p className="price">From <strong>{PRO_PRICE_MONTHLY}</strong>/mo</p>
  <ul className="feature-list">
    <li>✓ Unlimited clips</li>
    <li>✓ Clips up to 2 min</li>
    <li>✓ AI captions</li>
    <li>✓ Split-screen</li>
    <li>✓ 4K export</li>
    <li>✓ Priority processing</li>
  </ul>
  <a href="/pricing?ref=paywall" className="btn-primary">Upgrade Now</a>
  <a href="/pricing" className="link-secondary">See all plans →</a>
</div>
```

---

### Improvement 2 — Dashboard: contextual upgrade banner when user is at or near limit

**File(s):** Dashboard page/component and/or a shared `components/UpgradeBanner.tsx`

**Requirements:**
- When the user is at **≥ 80% of their free clip quota** (or fully blocked), show a slim banner or sidebar widget containing:
  - Current usage context, e.g. `"You've used X of Y free clips"`
  - Pro plan price
  - Key benefits: `Unlimited uploads · Analytics · Distribution`
  - A **"See plans"** link to `/pricing?ref=dashboard-banner`
- If a `useUser` / `usePlan` / `useQuota` hook or similar already exists, use it to read current usage. If not, read from whatever auth/session context is available.
- Banner should be dismissible (localStorage key `upgrade_banner_dismissed`) but re-appear if user reaches 100% of quota regardless of dismissal
- Do not show banner to Pro users

---

### Improvement 3 (continued) — Already covered in Improvement 1 & 3 combined above

The secondary `"See all plans →"` link inside the paywall modal satisfies this item. Ensure it is present.

---

### Improvement 4 — Free plan clip limit copy: add clarifying callout

**File(s):** Pricing page (`app/pricing/page.tsx` or equivalent) — whichever file renders the Free plan card and displays "Clips up to 60s"

**Requirements:**
- Locate the text "Clips up to 60s" (or equivalent) in the Free plan card
- Directly beneath it, add a one-line helper text or tooltip:
  - Inline option: `<p className="text-sm text-muted">Ideal for highlight moments & short-form hooks</p>`
  - Tooltip option: wrap the limit text in a `<Tooltip content="Perfect for TikTok highlights and short-form content">` if a Tooltip component already exists in the codebase
- Prefer whichever approach is already established in the codebase for helper text
- Do not change the limit value itself, only add context

---

### Improvement 5 — Upload page header: add visible upgrade link/sticky banner

**File(s):** Upload page (`app/upload/page.tsx` or equivalent) and/or its layout

**Requirements:**
- Add a **sticky top banner** that is shown when the user has reached their free upload limit:
  ```
  "You've reached your free clip limit — Upgrade for unlimited uploads  [Upgrade to Pro →]"
  ```
  - Banner background: amber/yellow warning tone (use existing design tokens if available, e.g. `bg-amber-50 border-amber-300`)
  - CTA links to `/pricing?ref=upload-banner`
  - Banner only shows when the user is limit-reached (reuse the same quota check logic as Improvement 2)
- Additionally, add an **"Upgrade to Pro"** link/button in the upload page header next to the existing "Dashboard" link, visible at all times (not only at limit) for Pro upsell:
  ```tsx
  <a href="/pricing?ref=upload-header" className="btn-outline-sm">Upgrade to Pro</a>
  ```
- Do not remove the existing "Dashboard" link

---

## Implementation Notes

- **Reuse existing UI components** (Button, Modal, Banner, Tooltip, etc.) wherever they exist — do not introduce a new component library
- **Reuse existing plan/quota constants** — do not hardcode prices in more than one place. If a central config doesn't exist, create `lib/plans.ts` with:
  ```ts
  export const PLANS = {
    free: { clipLimitSeconds: 60, clipCount: 3 },
    pro: { clipLimitSeconds: 120, clipCount: Infinity, priceMonthly: 19 },
  } as const;
  ```
  Then import from this file everywhere else.
- **UTM/ref params on all upgrade links** — each CTA should carry a `?ref=` param so marketing can track which touchpoint converts (values specified per improvement above)
- **No design system changes** — match existing className conventions exactly (Tailwind, CSS Modules, styled-components — whatever the project uses)
- **TypeScript** — all new files must be `.tsx`/`.ts` with proper types; do not use `any`

---

## Definition of Done

- [ ] **Improvement 1:** Paywall modal/overlay displays Pro price, feature list (`Unlimited clips · 2 min · AI captions · Split-screen · 4K export · Priority processing`), primary "Upgrade Now" CTA, and secondary "See all plans →" link — all visible without leaving the modal
- [ ] **Improvement 2:** Dashboard shows a slim upgrade banner/widget when user is at ≥ 80% or 100% of free quota, displaying usage stats, Pro price, key benefits, and a "See plans" link; banner is dismissible via localStorage but reappears at 100%; banner is hidden for Pro users
- [ ] **Improvement 3:** Paywall modal includes a secondary "See all plans →" link (satisfied by Improvement 1 implementation); clicking it routes to `/pricing` without requiring any additional navigation steps
- [ ] **Improvement 4:** Free plan card on the pricing page shows a one-line clarifying helper text or tooltip beneath "Clips up to 60s" explaining the use case (e.g. "Ideal for highlight moments & short-form hooks")
- [ ] **Improvement 5:** Upload page has a sticky amber top banner (limit-reached users only) with upgrade CTA linking to `/pricing?ref=upload-banner`, AND a persistent "Upgrade to Pro" header link visible to all free users linking to `/pricing?ref=upload-header`; existing "Dashboard" link is untouched

---

## Commit message

```
improve: weekly batch — inline pro pitch in paywall, dashboard upgrade banner, upload page upgrade CTAs, free plan clip limit clarification
```