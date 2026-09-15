# Billing & Plans

Stripe-based freemium model. No trials — users start free and upgrade when ready.

## Plan Ladder

| | Free | Pro ($19/mo) | Studio ($24 launch / $29 regular) |
|---|---|---|---|
| Videos/month | 3 | 30 | 120 (90 baseline + 30 bonus) |
| Max clip duration | 60s | 120s | 120s |
| Max upload size | 200 MB | 500 MB | 500 MB |
| Watermark | Forced | No | No |
| Custom branding | No | Yes | Yes |
| Trending dashboard | No | Yes | Yes |
| Multi-platform publish | No | No | Yes |
| Aspect ratios | 1 | 3 | Unlimited |
| Remake This | 3/mo | Unlimited | Unlimited |

Studio launch price ($24 instead of $29) active until `STUDIO_LAUNCH_ENDS_AT` (2026-09-30). `isStudioLaunchActive()` controls UI strikethrough display.

## Comp Accounts

`profiles.is_comp = true` grants Pro features for free. `comp_note` stores reason (e.g. "beta tester wave 1"). Migration: `20260702_comp_accounts.sql`.

`resolveEffectivePlan()` in `lib/plans.ts` resolves the effective plan: comp accounts always return `'pro'` regardless of stored plan. Use this everywhere for rights/quotas.

## Top-Up Packs

One-time clip packs (not subscriptions). Two sizes:
- **Pack 5**: +5 clips ($STRIPE_PRICE_PACK5)
- **Pack 10**: +10 clips ($STRIPE_PRICE_PACK10)

Checkout via `POST /api/stripe/topup` (mode: `payment`). Webhook grants clips via `add_bonus_videos` RPC on `checkout.session.completed` with `metadata.type === 'topup'`.

## Stripe Checkout (`POST /api/stripe/checkout`)

1. Validate plan (pro | studio) + optional `promo_code`
2. Find or create Stripe customer (`profiles.stripe_customer_id`)
3. Look up promo code in Stripe promotion codes (if provided)
4. Create checkout session (mode: `subscription`, payment methods: card + Link)
5. Success redirect: `/settings?checkout=success&plan={plan}`

Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO`.

## Stripe Portal (`POST /api/stripe/portal`)

Creates a Billing Portal session for existing customers. Requires `stripe_customer_id` on profile. Returns portal URL, redirects back to `/settings`. POST-only (no GET — prevents CSRF).

## Stripe Webhook (`POST /api/stripe/webhook`)

User-side webhook. Signature verified with `STRIPE_WEBHOOK_SECRET`. Idempotency via `stripe_events` table. Rate limited: 100 req/min.

### Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Update `profiles.plan`, set `stripe_customer_id`. Track affiliate conversion if referral exists. Discord notification. |
| `checkout.session.completed` (topup) | Grant bonus clips via `add_bonus_videos` RPC |
| `customer.subscription.updated` | Sync plan from price ID. Downgrade to free if subscription inactive. |
| `customer.subscription.deleted` | Downgrade to free. Discord churn alert with cancel reason. |
| `invoice.payment_failed` | Log failure + Discord alert with attempt count |

### Affiliate Conversion (in checkout webhook)

On paid checkout, checks `referrals` table for the user. If found:
- Marks referral as `converted`
- Calculates commission at affiliate's rate (default 20% for user affiliates)
- Updates affiliate totals via `increment_affiliate_conversion` RPC
- Discord notification to `#conversions`

## Admin Stripe Webhook (`POST /api/admin/webhooks/stripe`)

Separate webhook for influencer affiliate commission lifecycle. Uses `STRIPE_ADMIN_WEBHOOK_SECRET` (different from user webhook secret).

| Event | Handler | Action |
|---|---|---|
| `invoice.payment_succeeded` | `handlePaymentSucceeded` | 30% commission to `affiliate_commission_ledger` |
| `charge.refunded` | `handleChargeRefunded` | Clawback entry (delta-based, prevents double clawback) |
| `charge.dispute.created` | `handleDisputeCreated` | Fraud flag (critical) + clawback entry |
| `account.updated` | `handleAccountUpdated` | Update Connect KYC status |
| `transfer.created` | `handleTransferPaid` | Mark payout as sent |
| `transfer.reversed` | `handleTransferFailed` | Mark payout as failed |

Idempotency via `webhook_events` table (`ON CONFLICT (provider, event_id) DO NOTHING`).

## Quota Enforcement

### Video Limit (`checkVideoLimit`)
Compares `monthlyVideosUsed` against plan's `maxVideosPerMonth`. Returns `allowed: false` with upgrade message when exceeded.

### Clip Duration (`checkClipDuration`)
Blocks renders exceeding plan's `maxClipDurationSeconds` (Free: 60s, Pro/Studio: 120s). This is the real cost gate — Whisper bills by audio minute.

### Feature Access (`checkFeatureAccess`)
Checks boolean and numeric feature flags against plan limits. Returns the minimum plan required to unlock a gated feature.

### Pro Gate (Browse)
Master (>=95) and Legendary (>=80) clips visible but locked for free users: blur overlay + "Unlock with Pro" CTA.

## Discord Notifications

| Channel | Trigger |
|---|---|
| `#new-paid` | New subscription checkout |
| `#churn-alerts` | Subscription cancelled |
| `#stripe-events` | Payment failed, top-up purchased |
| `#conversions` | Affiliate conversion on checkout |

## Database

| Table | Purpose |
|---|---|
| `profiles` | `plan`, `stripe_customer_id`, `subscription_amount_cents`, `is_comp`, `comp_note` |
| `stripe_events` | Idempotency (event_id unique) |
| `referrals` | User affiliate referral tracking |
| `affiliate_codes` | User self-service affiliate codes |

## Env Vars

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | Stripe API calls |
| `STRIPE_WEBHOOK_SECRET` | Yes (fail-hard 500) | User webhook signature |
| `STRIPE_ADMIN_WEBHOOK_SECRET` | Yes (fail-hard 503) | Admin webhook signature |
| `STRIPE_PRICE_PRO` | Yes | Pro plan price ID |
| `STRIPE_PRICE_STUDIO` | Yes | Studio plan price ID |
| `STRIPE_PRICE_PACK5` | Yes | 5-clip top-up price ID |
| `STRIPE_PRICE_PACK10` | Yes | 10-clip top-up price ID |

## Key Files

- `lib/plans.ts` — plan definitions, quota checks, comp resolution
- `app/api/stripe/checkout/route.ts` — subscription checkout
- `app/api/stripe/portal/route.ts` — billing portal
- `app/api/stripe/topup/route.ts` — one-time clip packs
- `app/api/stripe/webhook/route.ts` — user webhook (plan sync, churn, affiliate)
- `app/api/admin/webhooks/stripe/route.ts` — admin webhook (commission, payouts)
- `lib/admin/webhooks/stripe-processor.ts` — commission + clawback + dispute handlers
