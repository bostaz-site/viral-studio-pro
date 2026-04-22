# Affiliate System

## Description

Full affiliate/referral tracking system. Admins create affiliates with unique handles and auto-generated promo codes. Affiliates share referral links (`viralanimal.com/ref/[handle]`) and promo codes (`[HANDLE]20`). Clicks are tracked, cookies are set (30 days), signups are attributed, and conversions (paid subscriptions) generate commissions.

## SQL Tables

### `affiliates`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | Affiliate display name |
| email | TEXT | Nullable |
| handle | TEXT | Unique, lowercase, alphanumeric |
| platform | TEXT | 'twitch' / 'youtube' / 'tiktok' / 'instagram' |
| niche | TEXT | |
| commission_rate | FLOAT | 0-1, default 0.2 (20%) |
| promo_code | TEXT | Auto-generated: `{HANDLE}{discount}` e.g. "SAMY20" |
| promo_discount_percent | INT | 5-50, default 20 |
| status | TEXT | 'active' / 'paused' / 'inactive' |
| notes | TEXT | Admin notes |
| total_clicks | INT | |
| total_signups | INT | |
| total_conversions | INT | |
| total_revenue | FLOAT | Total revenue from converted referrals |
| total_commission_earned | FLOAT | |
| total_commission_paid | FLOAT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `referrals`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| affiliate_id | UUID | FK -> affiliates.id |
| user_id | UUID | FK -> profiles.id (set on signup) |
| source | TEXT | 'link' |
| utm_source | TEXT | |
| utm_medium | TEXT | |
| utm_campaign | TEXT | |
| status | TEXT | 'clicked' / 'signed_up' / 'converted' |
| ip_address | TEXT | |
| user_agent | TEXT | |
| signed_up_at | TIMESTAMPTZ | |
| converted_at | TIMESTAMPTZ | |
| revenue_generated | FLOAT | |
| commission_amount | FLOAT | |
| created_at | TIMESTAMPTZ | |

### `affiliate_payouts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| affiliate_id | UUID | FK -> affiliates.id |
| amount | FLOAT | Payout amount |
| currency | TEXT | Default 'USD' |
| status | TEXT | 'pending' / 'paid' |
| payment_method | TEXT | |
| notes | TEXT | |
| period_start | TIMESTAMPTZ | Period covered |
| period_end | TIMESTAMPTZ | |
| paid_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

## API Routes

### `GET /api/admin/affiliates`

Admin-only. Lists all affiliates. Optional query param: `status`.

### `POST /api/admin/affiliates`

Admin-only. Creates a new affiliate.

**Request body**:
```json
{
  "name": "Samy",
  "handle": "samy",
  "email": "samy@example.com",
  "platform": "twitch",
  "niche": "gaming",
  "commission_rate": 0.2,
  "promo_discount_percent": 20,
  "notes": "Top streamer"
}
```

Auto-generates promo code: `{HANDLE.toUpperCase()}{discount}` -> "SAMY20".

### `GET /api/admin/affiliates/[id]`

Admin-only. Returns affiliate detail with referrals (last 100) and payouts (last 50).

### `PATCH /api/admin/affiliates/[id]`

Admin-only. Updates affiliate fields (name, email, platform, niche, commission_rate, status, notes, etc.).

### `DELETE /api/admin/affiliates/[id]`

Admin-only. Deletes the affiliate.

### `POST /api/admin/affiliates/[id]/payout`

Admin-only. Creates a payout record and increments `total_commission_paid`.

**Request body**:
```json
{
  "amount": 50.00,
  "notes": "March payout",
  "period_start": "2026-03-01T00:00:00Z",
  "period_end": "2026-03-31T23:59:59Z"
}
```

### `POST /api/referral/track`

Public endpoint (no auth). Tracks a referral click.

**Request body**:
```json
{
  "handle": "samy",
  "utm_source": "twitter",
  "utm_medium": "social",
  "utm_campaign": "launch"
}
```

Creates a `referrals` row with status 'clicked' and increments `affiliates.total_clicks`.

### `POST /api/referral/verify-code`

Public endpoint. Verifies a promo code against the `affiliates` table.

**Request body**: `{ "code": "SAMY20" }`

**Response**: `{ data: { valid: true, discount_percent: 20, affiliate_name: "Samy", affiliate_handle: "samy" } }`

## UI Components (Admin)

### `AffiliatesDashboard` (`components/admin/affiliates-dashboard.tsx`)

Main admin page for managing affiliates. Contains the table, detail panel, and create dialog.

### `AffiliateTable` (`components/admin/affiliate-table.tsx`)

Table listing all affiliates with columns: name, handle, status, clicks, signups, conversions, revenue, commission earned/paid.

### `AffiliateDetail` (`components/admin/affiliate-detail.tsx`)

Detail panel showing affiliate info, referral list, and payout history.

### `CreateAffiliateDialog` (`components/admin/create-affiliate-dialog.tsx`)

Dialog form for creating new affiliates.

### `PayoutDialog` (`components/admin/payout-dialog.tsx`)

Dialog for recording a payout to an affiliate.

## Zustand Store

### `useAffiliateStore` (`stores/affiliate-store.ts`)

| Field | Type | Description |
|-------|------|-------------|
| affiliates | Affiliate[] | All affiliates |
| loading | boolean | |
| error | string / null | |
| selectedDetail | AffiliateDetail / null | Selected affiliate with referrals + payouts |
| detailLoading | boolean | |
| fetchAffiliates(status?) | action | GET /api/admin/affiliates |
| createAffiliate(data) | action | POST /api/admin/affiliates |
| updateAffiliate(id, data) | action | PATCH /api/admin/affiliates/[id] |
| deleteAffiliate(id) | action | DELETE /api/admin/affiliates/[id] |
| fetchDetail(id) | action | GET /api/admin/affiliates/[id] |
| createPayout(affiliateId, data) | action | POST /api/admin/affiliates/[id]/payout |

## Referral Flow

1. Admin creates affiliate (handle: "samy") -> promo code "SAMY20" generated
2. Affiliate shares link: `viralanimal.com/ref/samy?utm_source=twitter`
3. User clicks link -> `/ref/[handle]` page:
   - Sets `ref=samy` cookie (30 days)
   - Sets UTM cookies if present
   - POST `/api/referral/track` (click recorded, affiliate.total_clicks incremented)
   - Redirects to `/invite`
4. User signs up (cookie `ref` is read during signup)
5. User subscribes -> Stripe webhook fires `checkout.session.completed`:
   - Finds referral for user in `referrals` table
   - Computes commission (amount * commission_rate)
   - Updates referral: status -> 'converted', revenue + commission recorded
   - Updates affiliate totals: total_conversions, total_revenue, total_commission_earned
6. Admin records payouts via `/api/admin/affiliates/[id]/payout`

## Technical Notes

- All admin endpoints are protected via `withAdmin` (email allowlist)
- Promo code format: `{HANDLE_UPPERCASE}{DISCOUNT_PERCENT}` (e.g. "SAMY20")
- Commission rate defaults to 20% (0.2) but is configurable per affiliate
- Referral cookie lasts 30 days
- Promo code validation happens both at checkout (for Stripe discounts) and via the verify endpoint (for UI display)
- Duplicate handle/promo_code returns 409
