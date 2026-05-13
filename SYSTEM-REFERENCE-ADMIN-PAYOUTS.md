# SYSTEM REFERENCE -- Admin Payouts & Stripe Connect (v1)

> Source de verite pour le systeme de payouts automatiques via Stripe Connect Express.
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/stripe/connect-onboarding.ts` | Create Connect Express account + onboarding link + send email |
| `lib/admin/stripe/payouts.ts` | Monthly payout processing, fraud checks, Stripe Transfer execution |
| `lib/admin/stripe/connect-webhooks.ts` | Handlers: account.updated, transfer.created, transfer.reversed |
| `app/api/admin/affiliates/[id]/onboard/route.ts` | POST: create Connect account + send onboarding email |
| `app/api/admin/affiliates/[id]/payout/route.ts` | POST: approve/reject pending_review payouts |
| `app/api/admin/payouts/route.ts` | GET: list all payouts with influencer info + summary |
| `app/api/cron/monthly-payouts/route.ts` | Cron: process monthly payouts (1st of month 9AM) |
| `app/api/admin/webhooks/stripe/route.ts` | Stripe webhook (extended with Connect events) |
| `app/(dashboard)/admin/payouts/page.tsx` | Admin payouts dashboard |
| `app/(dashboard)/admin/payouts/_components/payouts-table.tsx` | Payouts table component |
| `app/(dashboard)/admin/payouts/_components/manual-review-dialog.tsx` | Manual review approve/reject dialog |
| `app/partner/onboarding/page.tsx` | Partner KYC status page |
| `app/partner/payouts/page.tsx` | Partner payout history page |

---

## Stripe Connect Express Flow

```
1. Admin marks influencer status='onboarded'
   -> POST /api/admin/affiliates/[id]/onboard
   |
   v
2. Auto-assign affiliate_code (if needed)
   -> assignAffiliateCodeOnOnboarded()

3. Create Stripe Connect Express account
   -> stripe.accounts.create({ type: 'express' })
   -> Save stripe_connect_account_id + status='pending_kyc'

4. Generate onboarding link
   -> stripe.accountLinks.create({ type: 'account_onboarding' })

5. Send email via Resend with Stripe onboarding URL
   -> Influencer clicks link -> completes KYC on Stripe hosted flow

6. Stripe webhook: account.updated
   -> handleAccountUpdated()
   -> Update stripe_connect_status, charges_enabled, payouts_enabled
   -> Set stripe_connect_onboarded_at on first successful KYC

7. Influencer can now access /partner/onboarding to see status
```

---

## Monthly Payout Flow

```
1. Cron fires: POST /api/cron/monthly-payouts (1st of month 9AM)
   Auth: x-api-key = CRON_SECRET
   |
   v
2. Find eligible affiliates:
   - status IN (onboarded, active, paying)
   - affiliate_code IS NOT NULL
   - stripe_connect_account_id IS NOT NULL
   - stripe_connect_status = 'active'
   - stripe_connect_payouts_enabled = TRUE
   |
   v
3. For each affiliate:
   a. Idempotency check (no existing payout this period)
   b. Calculate payable amount from v_affiliate_balances - payout_holds
   c. Skip if < $50 minimum threshold
   |
   v
4. Fraud checks (runFraudChecks):
   SKIP payout if:
   - Critical fraud_flags (severity='critical', status='open')
   - Recent chargeback (last 90 days)
   - Less than 2 paid cycles

   MANUAL REVIEW if:
   - First payout ever (no sent payouts)
   - Amount > $500
   - Open fraud flags (medium/high severity)
   |
   v
5. Create affiliate_payouts record:
   - status='pending_review' if manual review needed
   - status='approved' if auto-approved
   |
   v
6. Auto-approved payouts execute immediately:
   a. Mark status='sending'
   b. stripe.transfers.create({ destination: connected_account_id })
      with idempotencyKey: payout_{id}
   c. Save stripe_transfer_id
   d. INSERT commission_ledger (event_type='payout_deduction', negative amount)
   |
   v
7. Manual review payouts wait for admin:
   POST /api/admin/affiliates/[id]/payout
   { action: 'approve' | 'reject', payout_id: '...' }
   -> approve: mark approved -> executePayout()
   -> reject: mark on_hold
   |
   v
8. Stripe webhook: transfer.created
   -> handleTransferPaid()
   -> Mark payout status='sent', sent_at=now()
   -> Send confirmation email to affiliate

9. Stripe webhook: transfer.reversed
   -> handleTransferFailed()
   -> Mark payout status='failed'
```

---

## Payout Statuses

| Status | Description |
|---|---|
| `pending_review` | Needs manual admin review (first payout, >$500, fraud flags) |
| `approved` | Reviewed and approved, ready to send |
| `pending` | Created but not yet processed |
| `on_hold` | Held (admin rejected or fraud check) |
| `sending` | Stripe Transfer in progress |
| `sent` | Transfer completed, funds delivered |
| `failed` | Transfer failed |
| `reversed` | Transfer reversed after sent |

---

## Database

### New columns on `influencers`
```
stripe_connect_onboarded_at TIMESTAMPTZ   -- when KYC was first completed
stripe_connect_charges_enabled BOOLEAN     -- from Stripe account.updated
stripe_connect_payouts_enabled BOOLEAN     -- from Stripe account.updated
```

### Existing columns on `influencers`
```
stripe_connect_account_id TEXT             -- Stripe acct_xxx ID
stripe_connect_status TEXT                 -- not_created/pending_kyc/active/restricted/rejected
```

### `affiliate_payouts` table
```
id, influencer_id, period_start_at, period_end_at,
gross_commission_cents, adjustments_cents, net_payout_cents,
included_referral_ids (UUID[]), referrals_count,
status (pending_review/approved/pending/on_hold/sending/sent/failed/reversed),
stripe_transfer_id (UNIQUE), stripe_transfer_status,
failure_reason, created_at, sent_at, updated_at
```

### Commission ledger entry on payout
```
event_type: 'payout_deduction'
amount_cents: negative (deducts from balance)
payout_id: FK to affiliate_payouts
```

---

## Fraud Checks

### Auto-skip (no payout)
- `fraud_flags` with severity='critical' AND status='open'
- `fraud_flags` with flag_type='chargeback_high_rate' in last 90 days
- Less than 2 unique paid months in commission ledger

### Manual review required
- First payout (no previous 'sent' payouts)
- Payout amount > $500
- Open fraud flags with severity='medium' or 'high'

---

## Webhook Events Handled

| Event | Handler | Action |
|---|---|---|
| `account.updated` | handleAccountUpdated | Update KYC status on influencer |
| `transfer.created` | handleTransferPaid | Mark payout as sent + email |
| `transfer.reversed` | handleTransferFailed | Mark payout as failed |
| `invoice.payment_succeeded` | handlePaymentSucceeded | Commission ledger entry |
| `charge.refunded` | handleChargeRefunded | Clawback entry |
| `charge.dispute.created` | handleDisputeCreated | Fraud flag + clawback |

---

## Env Vars

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API calls (already exists) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification (already exists) |
| `RESEND_API_KEY` | Send onboarding + payout confirmation emails |
| `CRON_SECRET` | Auth for monthly payout cron |

---

## Cron Configuration

```
POST /api/cron/monthly-payouts — monthly 1st 9AM (0 9 1 * *)
Auth: x-api-key: CRON_SECRET
```

Listed in netlify.toml comment block.

---

## Admin UI (/admin/payouts)

```
Header: Banknote icon + "Payouts" + "Stripe Connect affiliate payouts"
Badge: "{N} needs review" if pending_review payouts exist
Stats: Pending | Sent | On Hold | Total This Month
Filters: All | Needs Review | Approved | Sending | Sent | On Hold | Failed
Table: Affiliate | Period | Amount | Referrals | Status | Date | Action
Review dialog: Affiliate info + amount + approve/hold buttons
```

---

## Partner Portal Pages

### /partner/onboarding
- Shows Stripe Connect KYC verification status
- Status: Not Started / Verification Pending / Verified / Action Required / Rejected
- Verified state shows completion date
- Refresh button to re-check status

### /partner/payouts
- Total Paid | Available Balance | Next Payout date
- Payout history table: Period | Amount | Status | Date
- $50 minimum threshold info

---

## Anti-Patterns (DO NOT)

- Auto-payout without fraud check (always run runFraudChecks)
- First payout without manual review (always pending_review)
- Expose stripe_connect_account_id to client/partner (server only)
- Skip idempotency key on Stripe Transfer (use payout_{id})
- UPDATE/DELETE commission_ledger entries (immutable, use payout_deduction)
- Skip webhook_events idempotency (ON CONFLICT prevents double processing)

---

*Document version 1.0 -- Mai 2026*
*Branch: feature/admin-mailbox-health*
