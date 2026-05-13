# SYSTEM REFERENCE — Design System (v1)

> Palette finale Viral Animal: Dore (amber) + Cyan. Appliquee a toute l'app.
> Derniere mise a jour: Mai 2026.

---

## Palette

### Dore (Gold) — Action / Success / Money

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| Primary | `amber-500` | `#f59e0b` | CTAs, buttons default, active states, badges, money |
| Primary hover | `amber-600` | `#d97706` | Button hover |
| Primary text on | `amber-950` | `#451a03` | Text on amber backgrounds |
| Light accent | `amber-400` | `#fbbf24` | Icons, sidebar active, labels |
| Muted accent | `amber-500/15` | — | Badge backgrounds, subtle highlights |

### Cyan — Data / Tech / Info

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| Data accent | `cyan-400` | `#22d3ee` | Charts (Recharts), stats, links, info badges |
| Data bg | `cyan-500/15` | — | Badge backgrounds for data items |
| Chart stroke | `#22d3ee` | — | Recharts line/area strokes |

### Semantic Colors (unchanged)

| Color | Tailwind | Usage |
|---|---|---|
| Red | `red-400` / `red-500` | Errors, destructive, bounces, hostile |
| Green | `green-400` / `emerald-400` | Success, healthy, positive sentiment, inbound |
| Orange | `orange-400` / `amber-400` | Warnings (shared with gold, context-dependent) |

### Neutral

| Token | Tailwind | Usage |
|---|---|---|
| Background | `zinc-900` / `zinc-950` | Dark background |
| Card | `zinc-800` | Card backgrounds |
| Border | `zinc-700` / `zinc-800` | Borders, dividers |
| Text primary | `zinc-100` / `zinc-200` | Headings, body text |
| Text muted | `zinc-400` / `zinc-500` | Secondary text |

---

## CSS Variables

`--primary` and `--primary-foreground` are set to amber in both light and dark modes:

```css
:root {
  --primary: 37.7 92.1% 50.2%;       /* amber-500 */
  --primary-foreground: 21 77.8% 10%; /* amber-950 */
  --ring: 37.7 92.1% 50.2%;          /* amber-500 */
}
.dark {
  --primary: 37.7 92.1% 50.2%;       /* amber-500 */
  --primary-foreground: 21 77.8% 10%; /* amber-950 */
  --ring: 37.7 92.1% 50.2%;          /* amber-500 */
}
```

This cascades to all `bg-primary`, `text-primary`, `border-primary`, `ring-primary` usages including the `<Button>` default variant.

---

## Application Rules

### When to use Gold (amber)

- All primary CTAs: Upload, Generate, Publish, Upgrade, Send, Save
- Active filter pills / tab states
- Success badges, "Popular" badges
- Plan tier highlights
- Money displays ($MRR, commissions, revenue)
- Velocity badges (Hot/Viral)
- Admin section labels
- Outbound message indicators
- Send buttons in composers

### When to use Cyan

- All Recharts charts (strokes, fills, gradients)
- Creator rank badge
- Data/info stats cards (total clicks, emails sent, avg reputation)
- Info-level badges (scheduled, testing, neutral sentiment)
- Secondary links ("Learn more")
- Timeline selection indicators
- Data category labels

### When NOT to change

- Red = errors, destructive, bounces, hostile, declined
- Green = success, healthy, positive, active, inbound
- Orange = warnings (keep as-is, amber-400 overlap is intentional)
- Status color "cold" = blue (semantic — cold = blue is universally understood)

---

## Files Updated

### CSS Variables
- `app/globals.css` — `--primary`, `--primary-foreground`, `--ring` → amber

### User-Facing Pages
- `app/pricing/page.tsx` — gradient CTAs, tier accents, hero text
- `app/demo/demo-experience.tsx` — nav logo, hero, accent gradients
- `app/(auth)/layout.tsx` — panel gradient, glow orbs, logo

### Landing Components
- `components/landing/pricing-section.tsx` — CTA button gradient
- `components/landing/how-it-works-section.tsx` — step labels, CTAs, mockup accents
- `components/landing/invite-page.tsx` — hero gradient, CTA, feature card

### User Components
- `components/ui/button.tsx` — inherits via CSS var (no code change needed)
- `components/video/upload-zone.tsx` — progress bar gradient
- `components/trending/trending-filters.tsx` — active filter pills
- `components/settings/pricing-card.tsx` — plan colors, upgrade button
- `components/distribution/distribution-settings.tsx` — testing status badge
- `components/distribution/schedule-queue.tsx` — scheduled status

### Dashboard Pages
- `app/(dashboard)/dashboard/page.tsx` — twitch buttons, render notifications
- `app/(dashboard)/layout.tsx` — sidebar Analytics + Costs nav links

### Admin Pages (all violet/purple/blue → amber/cyan)
- `admin/analytics/page.tsx` — admin badge
- `admin/campaigns/page.tsx` — status badges
- `admin/campaigns/[id]/page.tsx` — status + segment tags
- `admin/campaigns/_components/campaign-form.tsx` — toggle buttons
- `admin/campaigns/_components/recipient-selector.tsx` — filter + selection
- `admin/campaigns/new/page.tsx` — step indicator
- `admin/domains/page.tsx` — header icon, stats
- `admin/streamers/page.tsx` — twitch badge
- `admin/mailboxes/page.tsx` — header icon, stats
- `admin/mailboxes/[id]/page.tsx` — KPIs
- `admin/affiliates/page.tsx` — stats
- `admin/affiliates/[id]/page.tsx` — stats
- `admin/affiliates/_components/commission-ledger-view.tsx` — event type
- `admin/suppression/page.tsx` — stats
- `admin/suppression/_components/suppression-table.tsx` — reason badges
- `admin/watchdog/_components/alerts-table.tsx` — severity + category
- `admin/webhooks/_components/webhook-table.tsx` — event type
- `admin/sync/_components/sync-status-card.tsx` — spinner
- `admin/_components/while-you-slept.tsx` — email icon
- `admin/payouts/_components/payouts-table.tsx` — status badges

### Inbox Components
- `inbox/_components/thread-list.tsx` — demo_sent status
- `inbox/_components/thread-detail.tsx` — outbound arrow
- `inbox/_components/reply-composer.tsx` — send button, focus rings
- `inbox/_components/suggested-drafts.tsx` — all purple → amber
- `inbox/_components/sentiment-badge.tsx` — neutral → cyan
- `inbox/_components/thread-summary.tsx` — status colors
- `inbox/_components/influencer-context-sidebar.tsx` — demo_sent status

### Partner Pages
- `partner/payouts/page.tsx` — status badges
- `partner/_components/stats-cards.tsx` — card accents
- `partner/_components/payout-schedule.tsx` — status
- `partner/_components/recent-referrals.tsx` — signup status

---

## Intentionally NOT Touched

| Item | Reason |
|---|---|
| `components/analytics/charts/*` | Recharts — cyan is correct, kept |
| `admin/_components/analytics/funnel-chart.tsx` | Funnel visualization colors, not UI chrome |
| `admin/mailboxes/_components/health-chart.tsx` | Recharts chart, cyan/green strokes |
| Logo gradient (FDE68A → F59E0B → B45309) | Already done |
| Wordmark "ANIMAL" amber-500 | Already done |
| Sidebar active states | Already done |
| Status "cold" = blue-500 | Semantic: cold = blue universally |
| Status "contacted" = sky-500 | Semantic: progression from cold |
| Red/green/orange semantic colors | Error/success/warning meaning |

---

## Build Verification

- `npm run build` — passes clean
- `npx tsc --noEmit` — 0 new errors
- No broken styling (all color changes are token-level, no layout impact)

---

*Document version 1.0 — Mai 2026*
