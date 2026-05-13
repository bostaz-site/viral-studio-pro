# SYSTEM REFERENCE — Partner Portal (v1)

> Source de verite pour le portail affilie (/partner/*) avec magic link auth.
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/partner/auth.ts` | Cookie session helpers: create, get, require, clear |
| `lib/partner/magic-link.ts` | Token generation + verification for magic links |
| `app/api/partner/auth/request/route.ts` | POST — send magic link email (Resend) |
| `app/api/partner/auth/verify/route.ts` | GET — verify token, create session, set cookie, redirect |
| `app/api/partner/auth/logout/route.ts` | POST/GET — clear cookie |
| `app/api/partner/stats/route.ts` | GET — dashboard stats (clicks, signups, paying, earnings) |
| `app/api/partner/ledger/route.ts` | GET — commission ledger, anonymized referrals, past payouts |
| `app/partner/layout.tsx` | Server layout — header with logo + "Partner Portal" |
| `app/partner/login/page.tsx` | Magic link request form |
| `app/partner/login/verify/page.tsx` | Token verify redirect page |
| `app/partner/page.tsx` | Dashboard — stats, code card, referrals, payouts |
| `app/partner/_components/stats-cards.tsx` | 4 stat cards: clicks, signups, paying, earnings |
| `app/partner/_components/code-card.tsx` | Affiliate code + link + copy button + QR code |
| `app/partner/_components/recent-referrals.tsx` | Anonymized referral list (User #XXXX) |
| `app/partner/_components/payout-schedule.tsx` | Next payout + past payout history |
| `app/partner/promo-kit/page.tsx` | Brand assets, social templates, email templates, stream assets |

---

## Database

### `partner_sessions` table
```
id UUID PK
influencer_id UUID FK -> influencers
token_hash TEXT UNIQUE (sha256 of raw token)
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ (30 days from creation)
last_used_at TIMESTAMPTZ
ip_address_hash TEXT
user_agent TEXT
```

---

## Auth Flow

```
1. User visits /partner/login
2. Enters email → POST /api/partner/auth/request
   |
   v
3. Find influencer WHERE email=? AND status IN ('onboarded','active','paying')
   - Not found? Return success anyway (prevent enumeration)
   |
   v
4. Generate 32-byte random token → hash(sha256) → INSERT partner_sessions
5. Send email with link: /partner/login/verify?t={raw_token}
   |
   v
6. User clicks link → GET /api/partner/auth/verify?t={token}
7. Verify token_hash, check not expired
8. Create new session cookie (va_partner_session)
9. Redirect to /partner
```

### Cookie: `va_partner_session`
- httpOnly: true
- secure: true (prod)
- sameSite: lax
- maxAge: 30 days
- Contains: raw session token (verified via sha256 hash lookup)

### Security
- Never reveal if email exists (always return success on login request)
- Tokens are 32 bytes random, stored as sha256 hash
- IP hashed with pepper via `hashIp()` from `lib/admin/ip-hash.ts`
- Session valid for 30 days, `last_used_at` updated on each access
- Only influencers with status in (onboarded, active, paying) can login

---

## Dashboard (/partner)

### Layout
```
Header: "Hi {name}" + Promo Kit button + Logout
Stats Cards: Clicks | Signups | Paying | Earned
Code Card: affiliate code + copy + link + QR
Two columns:
  Left: Recent Referrals (anonymized)
  Right: Payout Schedule
Footer: "30% recurring commission" info
```

### Stats Cards
- Total Clicks (+ this month)
- Signups (+ conversion rate)
- Paying Customers
- Total Earned (+ this month)

### Code Card
- Code: uppercase affiliate_code
- Link: viralanimal.com/r/{code} with copy button
- QR Code: generated via qrserver.com API (amber on dark)

### Referrals (Anonymized)
- "User #XXXX" — using first 4 chars of referral UUID
- Status badge: signed_up / trial / paying / churned
- Commission earned per referral
- Never exposes real user email or name

### Payout Schedule
- Next payout: amount, status (pending_review/approved/processing/sent)
- $50 minimum threshold indicator
- Past payout history (last 12)

---

## API Routes

### POST /api/partner/auth/request
Body: `{ email: string }`
Always returns `{ ok: true }` (no enumeration)

### GET /api/partner/auth/verify?t={token}
Redirects to /partner on success, /partner/login?error=expired on failure

### POST /api/partner/auth/logout
Clears cookie, returns `{ ok: true }`

### GET /api/partner/stats
Auth: cookie
Returns: `{ influencer, clicks, signups, paying, earnings, nextPayout }`

### GET /api/partner/ledger
Auth: cookie
Query: `page`
Returns: `{ ledger, referrals (anonymized), payouts }`

---

## Promo Kit (/partner/promo-kit)

Sections:
1. **Brand Assets** — logos (PNG, SVG), colors, banner
2. **Social Media Templates** — Tweet, TikTok caption, YouTube description, Discord
3. **Email Templates** — Short DM, email pitch, follow-up
4. **Stream Assets** — Twitch panel, overlay, chat command

Best practices guide included at top of page.

---

## Middleware Considerations

The existing `middleware.ts` protects `/dashboard` and `/settings` routes.
`/partner/*` routes are NOT in that middleware — auth is handled per-route via `requirePartnerAuth()`.

The `/partner/login` and `/partner/login/verify` pages are public (no auth required).
All other `/partner/*` pages check auth client-side via API calls.

---

## Tables Used

| Table | Access |
|---|---|
| `partner_sessions` | Auth sessions (INSERT/SELECT/UPDATE) |
| `influencers` | Read influencer profile + affiliate_code |
| `affiliate_clicks` | Count clicks by influencer_id |
| `affiliate_referrals` | Count signups/paying, anonymized list |
| `affiliate_commission_ledger` | Sum earnings, list history |
| `affiliate_payouts` | Payout history + next payout |

All queries use `createAdminClient()` (service_role) since partners are not Supabase Auth users.

---

*Document version 1.0 — Mai 2026*
*Branch: feature/affiliate-portal*
