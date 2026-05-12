# SYSTEM REFERENCE — Admin Affiliates & Attribution (v1)

> Source de verite pour l'attribution affiliee, le commission ledger, et le Stripe webhook handler.
> Derniere mise a jour : 2026-05-12.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/affiliate-code.ts` | Generation + assignment auto de code affiliee sur status='onboarded' |
| `lib/admin/affiliate-attribution.ts` | Attribution signup via cookie / fingerprint / IP match |
| `lib/admin/ip-hash.ts` | Hash IP avec pepper (AFFILIATE_IP_PEPPER) — jamais de raw IP |
| `lib/admin/webhooks/stripe-processor.ts` | Handlers: payment_succeeded, charge.refunded, charge.dispute.created |
| `app/r/[code]/route.ts` | Redirect public + affiliate_clicks INSERT + cookie va_ref 60j |
| `app/api/admin/webhooks/stripe/route.ts` | Stripe webhook endpoint avec signature + idempotency webhook_events |
| `app/api/admin/influencer-affiliates/route.ts` | API GET (list) + POST (assign code) pour influencer-affiliates |
| `app/api/admin/influencer-affiliates/[id]/route.ts` | API GET detail: influencer + referrals + ledger + clicks + balance |
| `app/(dashboard)/admin/affiliates/page.tsx` | Page admin affilies — tabs (Influencer / Legacy) + stats |
| `app/(dashboard)/admin/affiliates/[id]/page.tsx` | Detail affilie — stats, commission ledger, referrals, clicks |
| `app/(dashboard)/admin/affiliates/_components/commission-ledger-view.tsx` | Table immutable ledger avec balance summary |
| `app/(dashboard)/admin/affiliates/_components/influencer-affiliate-table.tsx` | Table influencer affiliates avec code, referrals, earned, due |

---

## Attribution Flow (Cookie + Fingerprint)

```
1. Influencer gets affiliate_code on status='onboarded'
   Format: 'va-{handle}' ou 'va-{random6}'
   Function: assignAffiliateCodeOnOnboarded()

2. Link shared: viralanimal.com/r/{code}
   → GET /r/[code]/route.ts

3. Click tracking:
   a. Resolve affiliate_code → influencer
   b. Extract: ip_hash (sha256+pepper), fingerprint_hash, UA, geo, UTMs
   c. INSERT affiliate_clicks (non-blocking)
   d. Set cookie: va_ref={code}, maxAge=60d, sameSite=lax
   e. Redirect to landing (/ or ?landing=...)

4. Signup attribution:
   a. Signup form reads cookie va_ref OR localStorage OR URL ?ref=
   b. Server-side: attributeSignup() checks:
      - Cookie-based: affiliate_code → influencers.affiliate_code
      - Fingerprint: match in affiliate_clicks (last 60 days)
      - IP hash: weakest signal, last resort
   c. INSERT affiliate_referrals (influencer_id, user_id, attribution_type)
   d. INSERT product_activation_events (user_signed_up)
   e. Mark affiliate_clicks.signup_user_id

5. Payment → Commission:
   a. Stripe sends invoice.payment_succeeded
   b. webhook_events idempotency check (ON CONFLICT DO NOTHING)
   c. Find profile by stripe_customer_id
   d. Find affiliate_referrals by user_id
   e. Calculate commission: amount * 0.30 (30% lifetime)
   f. INSERT affiliate_commission_ledger (event_type='payment_earned')
   g. INSERT product_activation_events (trial_converted_paid)

6. Refund → Clawback:
   a. Stripe sends charge.refunded
   b. Find original payment user → referral
   c. INSERT commission_ledger (event_type='refund_clawback', negative amount)

7. Chargeback → Fraud flag + Clawback:
   a. Stripe sends charge.dispute.created
   b. Find ledger entry by stripe_charge_id
   c. INSERT commission_ledger (event_type='chargeback_clawback')
   d. INSERT fraud_flags (severity='high')
```

---

## Commission Ledger (Immutable)

```sql
affiliate_commission_ledger:
  id UUID PK
  influencer_id UUID FK → influencers
  referral_id UUID FK → affiliate_referrals
  user_id UUID FK → auth.users
  event_type TEXT: payment_earned | refund_clawback | chargeback_clawback | manual_adjustment | payout_deduction
  amount_cents BIGINT (positive = earned, negative = clawback)
  currency TEXT (default 'usd')
  stripe_invoice_id TEXT
  stripe_charge_id TEXT
  stripe_refund_id TEXT
  webhook_event_id UUID FK → webhook_events
  notes TEXT
  created_at TIMESTAMPTZ

NO UPDATE/DELETE policies — immutable by design.
Only service_role (admin client) can INSERT.
Balance = SUM(amount_cents) per influencer.
```

---

## Stripe Webhook Handler

```
POST /api/admin/webhooks/stripe

1. Verify signature (STRIPE_WEBHOOK_SECRET)
2. INSERT webhook_events (provider='stripe', event_id=event.id)
   ON CONFLICT (provider, event_id) → return duplicate
3. Process by event.type:
   - invoice.payment_succeeded → handlePaymentSucceeded()
   - charge.refunded → handleChargeRefunded()
   - charge.dispute.created → handleDisputeCreated()
4. Mark webhook_events.processing_status = completed|failed

Existing handler: /api/stripe/webhook (handles checkout.session.completed, subscription updates)
New handler: /api/admin/webhooks/stripe (handles payment/refund/chargeback → commission ledger)
```

---

## Click Tracking (/r/[code])

```
GET /r/{code}

1. Lookup influencers.affiliate_code = code
2. Fallback: redirect to /ref/{code} (user-facing affiliate system)
3. INSERT affiliate_clicks:
   - ip_hash: sha256(ip + AFFILIATE_IP_PEPPER)
   - fingerprint_hash: sha256(ip + UA + accept-language + PEPPER)
   - ip_country: x-country or x-nf-client-connection-ip-country header
   - utm_source, utm_medium, utm_campaign from query params
4. Set cookie: va_ref={code}, 60 days
5. Redirect to / or ?landing=... path
```

---

## API Routes

### GET /api/admin/influencer-affiliates

Returns influencers with affiliate_code, sorted by total_commission_earned_cents DESC.
Query param `?all=true` includes influencers without codes.

### POST /api/admin/influencer-affiliates

Body: `{ "influencer_id": "uuid" }`
Assigns a new affiliate_code if the influencer doesn't have one.

### GET /api/admin/influencer-affiliates/[id]

Returns:
```json
{
  "influencer": { ... },
  "referrals": [...],
  "ledger": [...],
  "clicks": [...],
  "balance": { "earned_cents": 1500, "clawback_cents": -300, "available_cents": 1200 }
}
```

---

## Database Tables

| Table | Role |
|---|---|
| `influencers` | affiliate_code field, commission totals |
| `affiliate_clicks` | Per-click tracking with ip_hash, fingerprint, UTMs |
| `affiliate_referrals` | User → influencer attribution with type + status |
| `affiliate_commission_ledger` | IMMUTABLE ledger: earned, clawback, adjustment, payout |
| `fraud_flags` | Suspicious patterns (chargebacks, self-referral) |
| `payout_holds` | 30-day refund window enforcement |
| `webhook_events` | Idempotency layer (provider + event_id unique) |
| `product_activation_events` | Signup/conversion tracking per referred user |

---

## Admin UI

```
/dashboard/admin/affiliates
  1. Header — Handshake icon + "Affiliates" + subtitle
  2. Stats — Active Affiliates | Paying Referrals | Total Earned | Commission Due
  3. Tabs — "Influencer Affiliates" | "Creator Affiliates (Legacy)"
  4. Influencer tab → InfluencerAffiliateTable (name, code, status, referrals, earned, due)
  5. Legacy tab → AffiliatesDashboard (existing component)

/dashboard/admin/affiliates/[id]
  1. Header — name + code + handle + status badge
  2. Stats — Clicks | Referrals | Paying | Link
  3. CommissionLedgerView — balance cards + immutable ledger table
  4. Referrals list — user_id, attribution_type, status, date
```

---

## Env Vars

| Variable | Purpose |
|---|---|
| `AFFILIATE_IP_PEPPER` | 32-char random string for IP hashing (never store raw IP) |
| `STRIPE_WEBHOOK_SECRET` | Stripe signature verification |
| `STRIPE_SECRET_KEY` | Stripe API calls |

---

## Anti-Patterns (DO NOT)

- INSERT commission_ledger from client (service_role only)
- Store raw IP in affiliate_clicks (hash with pepper)
- Skip ON CONFLICT on webhook_events (causes double commission)
- Calculate commission client-side (always via webhook)
- Auto-payout without manual review for first payout
- UPDATE or DELETE rows in commission_ledger (immutable)
