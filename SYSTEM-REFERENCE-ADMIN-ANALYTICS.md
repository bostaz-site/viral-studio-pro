# SYSTEM REFERENCE — Admin Analytics & Cost Tracker (v1)

> Pipeline analytics, revenue dashboard, affiliate leaderboard, campaign performance, cohort retention, and P&L cost tracking.

---

## Architecture

### Pages

| Route | File | Description |
|---|---|---|
| `/admin/analytics` | `analytics/page.tsx` | Events overview (existing) + sub-page nav tabs |
| `/admin/analytics/funnel` | `analytics/funnel/page.tsx` | Acquisition funnel: cold → paying |
| `/admin/analytics/revenue` | `analytics/revenue/page.tsx` | MRR, ARR, plan breakdown |
| `/admin/analytics/affiliates` | `analytics/affiliates/page.tsx` | Top 20 leaderboard with tier badges |
| `/admin/analytics/campaigns` | `analytics/campaigns/page.tsx` | Campaign comparison table |
| `/admin/analytics/cohorts` | `analytics/cohorts/page.tsx` | Monthly cohort retention |
| `/admin/costs` | `costs/page.tsx` | P&L, auto costs, manual entries, add cost modal |

### Chart Components

| File | Description |
|---|---|
| `_components/analytics/funnel-chart.tsx` | Horizontal bar funnel (11 stages) |
| `_components/analytics/revenue-chart.tsx` | Recharts BarChart — MRR by plan |
| `_components/analytics/leaderboard-table.tsx` | Top 20 affiliates with tier badges |
| `_components/analytics/campaign-table.tsx` | Campaign comparison table |
| `_components/analytics/cohort-table.tsx` | Retention heatmap table |
| `_components/analytics/pnl-card.tsx` | Revenue - costs = net profit |

### API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/analytics/funnel` | Acquisition funnel data |
| `GET` | `/api/admin/analytics/revenue` | MRR/ARR/plan breakdown |
| `GET` | `/api/admin/analytics/affiliates` | Top 20 affiliate leaderboard |
| `GET` | `/api/admin/analytics/campaigns` | Campaign performance metrics |
| `GET` | `/api/admin/analytics/cohorts` | Monthly cohort retention |
| `GET` | `/api/admin/costs?month=YYYY-MM` | Monthly costs + P&L |
| `POST` | `/api/admin/costs` | Add manual cost entry |

### Library

| File | Description |
|---|---|
| `lib/admin/analytics/aggregators.ts` | Funnel, revenue, leaderboard, campaigns, cohorts |
| `lib/admin/costs/calculator.ts` | Auto-compute + manual costs + P&L |

---

## Acquisition Funnel

11 pipeline stages from `influencers.status`:

```
cold → queued → contacted → opened → replied → interested → demo_sent → evaluating → onboarded → active → paying
```

Each stage count is cumulative (includes all subsequent stages). Displayed as horizontal bars with percentage.

---

## Revenue Dashboard

### MRR Calculation

```
MRR = SUM(profiles WHERE plan != 'free') * plan_price
```

Plan prices: free=$0, pro=$29, studio=$49.

### Metrics

- **MRR**: Monthly Recurring Revenue (live from profiles)
- **ARR**: MRR * 12
- **Plan Breakdown**: Count + MRR per plan
- **Total Customers**: Profiles with paid plans

---

## Affiliate Leaderboard

### Tier System

| Tier | Paying Users | Badge |
|---|---|---|
| Bronze | 1-5 | 🥉 |
| Silver | 6-20 | 🥈 |
| Gold | 21+ | 🥇 |

### Metrics Per Affiliate

- Total conversions (paying users)
- Total revenue brought ($)
- Commission earned ($)
- Conversion rate (conversions / signups %)

Data source: `affiliates` table, sorted by `total_revenue_cents DESC`, top 20.

---

## Campaign Performance

Per campaign from `email_campaigns` table:

- Sent count
- Open rate (%)
- Reply rate (%)
- Bounce rate (%)
- Conversion rate (%)
- Status badge (running/completed/paused/draft)

---

## Cohort Retention

Monthly cohorts from `influencers.created_at`. Retention measured by `last_active_at`:

| Column | Meaning |
|---|---|
| M+1 | % still active 1 month after prospection |
| M+2 | % still active 2 months |
| M+3 | % still active 3 months |
| M+6 | % still active 6 months |

Color coding: green (>60%), amber (30-60%), red (<30%).

---

## Cost Tracker

### Auto-Computed Costs

| Source | Calculation |
|---|---|
| Anthropic API | SUM(ai_calls.cost_usd) for the month |
| Stripe Fees | MRR * 2.9% + $0.30 per paying customer |
| Affiliate Commissions | SUM(affiliate_commission_ledger WHERE event_type='payment_earned') |

### Manual Costs

Stored in `costs_manual` table. Categories: infra, cold_email, tools, vas, legal, banking, taxes, misc.

Add via modal form in the costs page.

### P&L View

```
Revenue (MRR)
- Stripe Fees
- Affiliate Commissions
- Infrastructure + AI
- Tools & SaaS
- Other
= Net Profit
```

---

## Database

### Table: `costs_manual`

Migration: `supabase/migrations/20260514_costs_tracking.sql`

```sql
CREATE TABLE public.costs_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,      -- infra, cold_email, tools, vas, legal, banking, taxes, misc
  vendor TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  billing_period_start DATE,
  billing_period_end DATE,
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id)
);
```

### Existing Tables Used

- `influencers` — funnel stages, cohort analysis
- `profiles` — MRR calculation
- `affiliates` — leaderboard
- `email_campaigns` — campaign performance
- `ai_calls` — Anthropic API costs
- `affiliate_commission_ledger` — commission costs

---

## Navigation

Added to admin sidebar:
- Analytics (PieChart icon) → `/admin/analytics`
- Costs (DollarSign icon) → `/admin/costs`

Sub-page tabs visible on all analytics pages: Events | Funnel | Revenue | Affiliates | Campaigns | Cohorts | Costs

---

## Anti-Patterns Avoided

- Single query per metric (no N+1)
- No `SELECT *` on large tables (select specific columns)
- Indexed columns for sorting (billing_period_start, created_at)
- Cents-based money (BIGINT, never floats)

---

*Document version 1.0 — Mai 2026*
*Branch: feature/admin-mailbox-health*
