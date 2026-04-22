# Billing & Stripe

## Description

Three subscription tiers (Free, Pro, Studio) managed through Stripe. Checkout sessions, webhook handling for subscription lifecycle events, customer portal for managing subscriptions, and promo code support for affiliates.

## Plans

| Plan | Price | Videos/Month | Max Duration | Watermark | Trial |
|------|-------|-------------|--------------|-----------|-------|
| Free | $0 | 3 | 60s | Yes | -- |
| Pro | $19/mo | 30 | 120s | No | 7-day free trial |
| Studio | $24/mo (launch) / $29 (regular) | 120 (90 + 30 bonus) | 120s | No | -- |

### Feature Matrix

| Feature | Free | Pro | Studio |
|---------|------|-----|--------|
| Custom Branding | -- | Yes | Yes |
| Split-Screen | Yes | Yes | Yes |
| Trending Dashboard | -- | Yes | Yes |
| Multi-Platform Publish | -- | -- | Yes |
| AI Voiceover | -- | -- | Yes |
| API Access | -- | -- | Yes |
| Export Formats | 1 | 3 | Unlimited |
| Remake This | 3/mo | Unlimited | Unlimited |

### Studio Launch Price

Studio is offered at $24/mo (launch price, regularly $29). Launch ends at `STUDIO_LAUNCH_ENDS_AT` (currently 2026-05-10). After that date, `isStudioLaunchActive()` returns false and the UI should stop showing the strikethrough price.

## SQL Tables

### `profiles` (billing-related columns)

| Column | Type | Notes |
|--------|------|-------|
| plan | TEXT | 'free' / 'pro' / 'studio' |
| stripe_customer_id | TEXT | Stripe customer ID |
| monthly_videos_used | INTEGER | Current month usage |

### `stripe_events`

| Column | Type | Notes |
|--------|------|-------|
| event_id | TEXT | Stripe event ID (PK, for idempotency) |
| event_type | TEXT | e.g. 'checkout.session.completed' |

## API Routes

### `POST /api/stripe/checkout`

Protected via `withAuth`.

**Request body**:
```json
{
  "plan": "pro" | "studio",
  "promo_code": "HANDLE20"  // optional
}
```

**Flow**:
1. Fetch or create Stripe customer
2. If promo_code provided, verify against `affiliates` table then look up Stripe promotion code
3. Create Stripe Checkout Session with subscription mode
4. Pro plan gets 7-day trial with `trial_settings.end_behavior.missing_payment_method: 'pause'`
5. Return checkout URL

**Response**: `{ data: { url: "https://checkout.stripe.com/..." } }`

### `POST /api/stripe/webhook`

Handles Stripe webhook events. Rate limited: 100 req/min. Verifies signature, checks idempotency via `stripe_events` table.

**Handled events**:
- `checkout.session.completed` -- Updates profile plan, tracks affiliate conversion
- `customer.subscription.updated` -- Syncs plan based on price ID and subscription status
- `customer.subscription.deleted` -- Resets plan to 'free'
- `invoice.payment_failed` -- Logged (no action yet)

**Affiliate conversion tracking** (on checkout.session.completed):
1. Checks `referrals` table for the user
2. If referral exists, computes commission (default 20% rate)
3. Updates referral status to 'converted'
4. Increments affiliate totals (conversions, revenue, commission_earned)

### `POST /api/stripe/portal`

Protected via `withAuth`. Creates a Stripe Billing Portal session for the user to manage their subscription.

**Response**: `{ data: { url: "https://billing.stripe.com/..." } }`

## UI Components

### Pricing Page (`app/pricing/page.tsx`)

3-column pricing grid with plan cards. Shows:
- Price (with strikethrough for Studio launch price)
- Feature list with checkmarks
- Trial note for Pro ("7 days free, no commitment")
- Launch countdown for Studio
- CTA buttons (Free -> login, Pro/Studio -> Stripe checkout or login redirect)

## Key Files

| File | Role |
|------|------|
| `lib/plans.ts` | Plan definitions, limits, enforcement utilities |
| `app/api/stripe/checkout/route.ts` | Checkout session creation |
| `app/api/stripe/webhook/route.ts` | Webhook handler |
| `app/api/stripe/portal/route.ts` | Billing portal |
| `app/pricing/page.tsx` | Pricing page UI |

## Enforcement Utilities (`lib/plans.ts`)

- `getPlanConfig(planId)` -- Returns plan config with limits
- `checkVideoLimit(plan, monthlyUsed)` -- Checks monthly quota
- `checkClipDuration(plan, durationSeconds)` -- Checks clip duration against plan limit
- `checkFeatureAccess(plan, feature)` -- Checks boolean feature gates
- `isStudioLaunchActive()` -- Whether the Studio launch promo is still active

## User Flow

1. User visits `/pricing`
2. Clicks on a plan CTA
3. If not logged in, redirected to login with plan in query params
4. POST `/api/stripe/checkout` creates Stripe session
5. User completes payment on Stripe
6. Webhook fires `checkout.session.completed`
7. Profile plan is updated in database
8. User redirected to `/settings?checkout=success`

## Technical Notes

- Stripe customer is created lazily (on first checkout)
- Pro trial is 7 days; on missed payment, subscription pauses (not cancels)
- Webhook idempotency via `stripe_events` table prevents double-processing
- Promo codes are verified both in the `affiliates` table and in Stripe's promotion codes
- If no Stripe promo code matches, checkout proceeds with `allow_promotion_codes: true` (user can enter codes on Stripe's page)
- Plan enforcement happens in `/api/render` (the only path into FFmpeg): duration check + monthly quota via `increment_video_usage` RPC
