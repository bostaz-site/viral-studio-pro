# Admin Dashboard

## Description

Admin-only pages for monitoring growth metrics, page view analytics/funnels, and managing affiliates. Access is controlled by `withAdmin` middleware which checks the user's email against an allowlist (`ADMIN_EMAILS` env var, defaults to `samycloutier30@gmail.com`).

## Access Control

### `withAdmin` (`lib/api/withAdmin.ts`)

Wraps `withAuth` and adds email check against `ADMIN_EMAILS` (comma-separated env var). Returns 403 if not admin.

### `isAdminEmail(email)` (`lib/api/withAdmin.ts`)

Utility function to check if an email is in the admin allowlist. Used by admin page components for client-side auth checks.

## Admin Pages

### `/admin/growth` -- Growth Metrics

**Page**: `app/(dashboard)/admin/growth/page.tsx`
**API**: `GET /api/admin/growth`

Displays:
- **Newsletter leads**: total count, last 14 days count, 20 most recent leads (email, source, created_at)
- **Referral stats**: total signups via referral, unique referrers count, top 10 referrers (email, name, referral_code, plan, invited_count)

Tables used: `newsletter_leads`, `profiles`

### `/admin/analytics` -- Page View Analytics

**Page**: `app/(dashboard)/admin/analytics/page.tsx`
**API**: `GET /api/admin/analytics`

Query param: `days` (default 14, max 90). Fetches up to 5000 recent rows from `analytics_events`.

Displays funnels:
- **Demo funnel**: demo_view -> demo_clip_switch -> demo_caption_switch -> demo_split_toggle -> demo_cta_click
- **Exit intent funnel**: exit_intent_shown -> exit_intent_submitted -> exit_intent_dismissed
- **CTA clicks**: cta_hero_click, cta_pricing_click, cta_signup_click
- **Page views**: page_view, demo_view, pricing_view, changelog_view

Also shows:
- Total events + unique sessions
- Top demo clips (by clip_id metadata)
- Top caption styles (by style metadata)
- 30 most recent events

Tables used: `analytics_events`

### `/admin/affiliates` -- Affiliate Management

**Page**: `app/(dashboard)/admin/affiliates/page.tsx`

Full CRUD for affiliates with referral tracking and payouts. See [affiliate-system.md](affiliate-system.md) for details.

Tables used: `affiliates`, `referrals`, `affiliate_payouts`

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/growth` | GET | Newsletter leads + referral stats |
| `/api/admin/analytics` | GET | Page view analytics + funnels |
| `/api/admin/affiliates` | GET | List affiliates |
| `/api/admin/affiliates` | POST | Create affiliate |
| `/api/admin/affiliates/[id]` | GET | Affiliate detail + referrals + payouts |
| `/api/admin/affiliates/[id]` | PATCH | Update affiliate |
| `/api/admin/affiliates/[id]` | DELETE | Delete affiliate |
| `/api/admin/affiliates/[id]/payout` | POST | Create payout |

All routes are protected with `withAdmin`.

## Key Files

| File | Role |
|------|------|
| `lib/api/withAdmin.ts` | Admin middleware + email check |
| `app/api/admin/growth/route.ts` | Growth metrics API |
| `app/api/admin/analytics/route.ts` | Analytics funnels API |
| `app/api/admin/affiliates/route.ts` | Affiliates list + create |
| `app/api/admin/affiliates/[id]/route.ts` | Affiliate CRUD |
| `app/api/admin/affiliates/[id]/payout/route.ts` | Payout creation |
| `app/(dashboard)/admin/growth/page.tsx` | Growth page |
| `app/(dashboard)/admin/analytics/page.tsx` | Analytics page |
| `app/(dashboard)/admin/affiliates/page.tsx` | Affiliates page |
| `components/admin/affiliates-dashboard.tsx` | Affiliates dashboard component |
| `components/admin/affiliate-table.tsx` | Affiliates table |
| `components/admin/affiliate-detail.tsx` | Affiliate detail panel |
| `components/admin/create-affiliate-dialog.tsx` | Create dialog |
| `components/admin/payout-dialog.tsx` | Payout dialog |

## Technical Notes

- Admin email allowlist is read from `ADMIN_EMAILS` env var (comma-separated)
- Default admin: `samycloutier30@gmail.com`
- Client-side admin check uses `isAdminEmail()` from `lib/auth/admin-emails.ts` -- redirects non-admins to `/dashboard`
- Analytics events are capped at 5000 rows per query to avoid memory issues
- All admin pages are client components that check auth before rendering
