# Partner System

Affiliate portal, repost kit, video library, Stripe Connect payouts. All partner-facing pages are public or cookie-auth (no Supabase Auth).

## Affiliate Program (Influencer)

30% lifetime recurring commission on referred paying users. Managed via admin CRM, separate from user self-service affiliates (20% in `affiliate_codes` table).

### Code Assignment

Code format: `va-{handle}` or `va-{random6}`. Auto-assigned on status `'onboarded'` via `assignAffiliateCodeOnOnboarded()`. Also auto-assigned at offer generation (`ensureAffiliateCode()`) so `{{affiliate_code}}` in email templates is never empty.

### Attribution Flow

```
1. Influencer shares viralanimal.com/r/{code}
2. GET /r/[code] → track click (ip_hash, fingerprint, UTMs) → set cookie va_ref (60 days) → redirect to landing
3. User signs up → client reads va_ref cookie → POST /api/affiliate/attribute
4. attributeSignup() tries 3 signals:
   a. Cookie-based (affiliate_code → influencer)
   b. Fingerprint match (last 60 days)
   c. IP hash match (weakest signal)
5. INSERT affiliate_referrals (status='attributed')
```

Anti self-referral: rejects if user email matches influencer email. 60-day attribution window. Unique index on `user_id` prevents double attribution.

### Commission Lifecycle

```
Signup (attributed) → First payment (paying) → Recurring payments (30% each)
                   ↘ Refund → clawback (delta-based)
                   ↘ Dispute → fraud flag (critical) + clawback
```

Commission base: 30% on `invoice.subtotal_excluding_tax`. Falls back to `amount_paid`.

### Commission Ledger (Immutable)

`affiliate_commission_ledger` — INSERT only, no UPDATE/DELETE. Service role only.

Event types: `payment_earned`, `refund_clawback`, `chargeback_clawback`, `manual_adjustment`, `payout_deduction`.

Balance = `SUM(amount_cents)` per influencer.

## Partner Portal (`/partner`)

Dashboard for influencer affiliates. Auth via magic link (no Supabase Auth account required).

### Magic Link Auth

1. Partner visits `/partner/login`, enters email
2. `POST /api/partner/auth/request` — finds influencer (status in onboarded/active/paying). Always returns success (no enumeration).
3. Email sent via Resend with link: `/partner/login/verify?t={token}`
4. Token: 32 bytes random, stored as SHA-256 hash. Expires in 15 minutes. Single-use.
5. On verify: magic link consumed (deleted), new session created (30 days)
6. Cookie: `va_partner_session` (httpOnly, secure, sameSite: lax, 30 days)

Rate limit: 3/hour per email + 3/hour per IP.

### Dashboard Layout

```
Header: "Hi {name}" + Promo Kit + Logout
Stats: Clicks | Signups | Paying | Earned (+ this month)
Code Card: affiliate code + copy link + QR code
Two columns: Recent Referrals (anonymized) | Payout Schedule
Footer: "30% recurring commission"
```

Referrals shown as "User #XXXX" (first 4 chars of UUID). Never exposes real user info.

### API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/partner/auth/request` | POST | None | Send magic link |
| `/api/partner/auth/verify` | GET | None | Verify token, create session |
| `/api/partner/auth/logout` | POST | Cookie | Clear session |
| `/api/partner/stats` | GET | Cookie | Dashboard stats |
| `/api/partner/ledger` | GET | Cookie | Commission ledger + payouts |

Auth checked per-route via `requirePartnerAuth()`. Only influencers with status in (onboarded, active, paying) can log in. All queries use `createAdminClient()` (service role).

### Promo Kit (`/partner/promo-kit`)

Brand assets (logos PNG/SVG), social media templates (Tweet, TikTok, YouTube, Discord), email templates (DM, pitch, follow-up), stream assets (panel, overlay, chat command).

## Stripe Connect Payouts

Monthly payouts via Stripe Connect Express.

### Onboarding Flow

1. Admin marks influencer `'onboarded'` → `POST /api/admin/affiliates/[id]/onboard`
2. Create Stripe Connect Express account → save `stripe_connect_account_id`
3. Generate onboarding link → send email via Resend
4. Influencer completes KYC on Stripe hosted flow
5. Webhook `account.updated` → update `stripe_connect_status`, `charges_enabled`, `payouts_enabled`
6. Partner sees status at `/partner/onboarding`

### Monthly Payout Flow

Cron: `POST /api/cron/monthly-payouts` (1st of month, 9AM). Auth: `CRON_SECRET`.

1. Find eligible affiliates (onboarded/active/paying, Connect active, payouts enabled)
2. Calculate payable from `v_affiliate_balances` minus `payout_holds`
3. Skip if < $50 minimum threshold
4. Run fraud checks:
   - **Auto-skip**: critical fraud flags, recent chargeback (90 days), <2 paid cycles
   - **Manual review**: first payout ever, amount >$500, open medium/high fraud flags
5. Create `affiliate_payouts` record (`pending_review` or `approved`)
6. Approved payouts execute: `stripe.transfers.create()` with idempotency key `payout_{id}`
7. Deduction entry in commission ledger (`payout_deduction`, negative amount)

### Payout Statuses

`pending_review` → `approved` → `sending` → `sent` (or `failed`/`reversed`/`on_hold`)

### Admin UI (`/admin/payouts`)

Stats: Pending | Sent | On Hold | Total This Month. Filters by status. Manual review dialog (approve/hold). Payouts table with affiliate, period, amount, referrals, status.

### Partner Payout Pages

- `/partner/onboarding` — Stripe Connect KYC status (Not Started / Pending / Verified / Action Required)
- `/partner/payouts` — Total Paid, Available Balance, Next Payout, history table. $50 minimum info.

## Repost Kit (`/partner/repost/[handle]`)

Public, mobile-first page for influencers to download, repost, and earn commission. No auth required — tracked via anonymous session.

### Flow

1. SSR page looks up influencer by `platform_handle` or `affiliate_code`
2. Creates `repost_kit_sessions` row (anonymous, IP hashed)
3. Client initializes tracker with session ID
4. 12-section layout: progress bar, video player (9:16) with download buttons, promo code card (`VIRAL-{code}`), FTC-compliant caption + hashtags, commission projection, social proof, platform links (TikTok/IG/YouTube), post URL submission form

### Tracking (16 Events)

Client-side batch queue, flushed every 5s. Critical events (downloads, copies, submissions) flush immediately. `navigator.sendBeacon` on unload.

| Critical Events | Non-Critical |
|---|---|
| `download_hd_clicked`, `download_mobile_clicked` | `kit_viewed`, `video_played`, `video_25/50/75_percent` |
| `caption_copied`, `code_copied`, `post_url_submitted` | `video_completed`, `hashtags_copied`, `platform_opened` |

Events capped at 50 per batch (DoS protection).

### Commission Projection

```
views = audience_size (or 5000 default)
signups = views * 0.2% conversion
monthly_low = signups * $24 avg * 30% * 0.5
monthly_high = signups * $24 avg * 30% * 1.5
```

### FTC Compliance

Caption always includes `#ad` and `#sponsored` disclosure tags. Non-removable.

## Video Library (`/admin/video-library`)

Admin-only. Promo videos for repost kits.

### Upload Pipeline

1. Admin uploads video → client extracts metadata (duration, dimensions) + generates thumbnail
2. Direct upload to Supabase Storage (`promo-videos` bucket) via signed URL
3. Tag with niches (multi-select), hook type, tone, language
4. Creates `promo_videos` record

### Tag Taxonomy

- **Niches** (TEXT[]): ai_tools, productivity, gaming, creator_tools, side_hustle, app_reviews, editing, streaming, business, education
- **Hook types**: curiosity, shock, transformation, social_proof, storytelling, tutorial, comparison, testimonial
- **Tones**: casual, professional, funny, inspirational, edgy
- **Languages**: en, fr, es, pt

### Performance Tracking

Daily aggregation in `promo_video_performance_daily`: kits generated, views, completions, code copies, posts submitted, signups attributed, revenue. Denormalized totals on `promo_videos` for fast grid.

### Connected Systems

- **Match Engine**: scores promo videos against influencer profiles (5 factors)
- **Repost Kit**: references `promo_video_id` in sessions
- **Offer Generator**: links offers to specific promo videos for personalized emails

## Database Tables

| Table | Purpose |
|---|---|
| `influencers` | `affiliate_code`, `stripe_connect_*` fields, commission totals |
| `affiliate_clicks` | Per-click tracking (ip_hash, fingerprint, UTMs) |
| `affiliate_referrals` | User-to-influencer attribution (status: attributed/paying/churned/refunded/disputed) |
| `affiliate_commission_ledger` | Immutable ledger (earned, clawback, adjustment, payout) |
| `affiliate_payouts` | Payout records with Stripe transfer IDs |
| `partner_sessions` | Magic link + session auth (session_type: magic_link/session) |
| `fraud_flags` | Suspicious patterns (chargebacks, self-referral) |
| `payout_holds` | 30-day refund window enforcement |
| `repost_kit_sessions` | Anonymous kit sessions |
| `repost_kit_events` | Tracking events (16 types) |
| `promo_videos` | Video library with tags + performance |
| `promo_video_assets` | HD/mobile/square/gif assets |
| `promo_video_performance_daily` | Daily metrics per video |

## Key Files

- `lib/admin/affiliate-code.ts` — code generation + auto-assignment
- `lib/admin/affiliate-attribution.ts` — signup attribution (cookie/fingerprint/IP)
- `lib/partner/auth.ts` — cookie session (create, get, require, clear)
- `lib/partner/magic-link.ts` — token generation + single-use verification
- `lib/partner/repost-kit/tracker.ts` — client-side event batcher
- `lib/partner/repost-kit/session.ts` — kit session management
- `lib/partner/repost-kit/projected-commission.ts` — commission projections
- `lib/admin/stripe/connect-onboarding.ts` — Connect Express account + onboarding
- `lib/admin/stripe/payouts.ts` — monthly payout processing + fraud checks
- `lib/admin/video-library/upload.ts` — signed URL generation
- `app/r/[code]/route.ts` — public affiliate redirect + click tracking
- `app/api/affiliate/attribute/route.ts` — server-side attribution
- `app/api/partner/` — auth, stats, ledger, repost routes
- `app/api/admin/affiliates/` — admin affiliate management
- `app/api/admin/payouts/route.ts` — payout list + summary
- `app/api/cron/monthly-payouts/route.ts` — monthly payout cron
