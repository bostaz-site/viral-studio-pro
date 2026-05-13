# SYSTEM REFERENCE — Admin Compliance Layer (v2 — V3 Extended)

> Ce fichier est la source de verite pour le module Compliance (Suppression List + Unsubscribe + 4-way + Provenance + FTC + GDPR).
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/admin/suppression/page.tsx` | Page admin suppression list — stats, table, add single, bulk add |
| `app/(dashboard)/admin/suppression/_components/suppression-table.tsx` | Table component — search, reason filter, pagination, remove with confirm |
| `app/(dashboard)/admin/suppression/_components/bulk-add-dialog.tsx` | Dialog bulk add — textarea 1 email/ligne, validation, reason picker |
| `app/api/admin/suppression/route.ts` | API CRUD — GET (list+stats), POST (add entries), DELETE (remove entry) |
| `app/unsubscribe/page.tsx` | Page publique unsubscribe — 1-click, no auth required |
| `app/api/unsubscribe/route.ts` | API publique — verify token, add to suppression, mark influencer blocked, mark token used |
| `lib/admin/unsubscribe-token.ts` | Token generation (randomBytes+sha256) + verification + mark used |
| `lib/admin/check-suppression.ts` | `filterSuppressed(emails[])` + `isSuppressed(email)` — pre-export filtering (re-exports 4-way) |
| `lib/admin/compliance/suppression-check.ts` | **V3** `isSuppressed4Way()` + `filterSuppressed4Way()` — 4-way batch check |
| `lib/admin/compliance/contact-validator.ts` | **V3** `validateContact()` — master validation (provenance + suppression + email) |
| `lib/admin/compliance/provenance-enforcer.ts` | **V3** `checkProvenance()` — NO source_url = NO contact |
| `lib/admin/compliance/disclosure-checker.ts` | **V3** `captionHasDisclosure()` + `validateCaptionForKit()` — FTC check |
| `lib/admin/compliance/audit-logger.ts` | **V3** `logComplianceAction()` — fire-and-forget audit log |
| `app/(dashboard)/admin/compliance/page.tsx` | **V3** Compliance dashboard — stats, blocks, audit log, GDPR |
| `app/(dashboard)/admin/compliance/_components/suppression-stats.tsx` | Stats cards |
| `app/(dashboard)/admin/compliance/_components/audit-log-viewer.tsx` | Filterable audit log table |
| `app/(dashboard)/admin/compliance/_components/recent-blocks.tsx` | Recent blocks panel |
| `app/(dashboard)/admin/compliance/_components/gdpr-requests.tsx` | GDPR export/delete panel |
| `app/api/admin/compliance/check/route.ts` | **V3** POST — validate contact before action |
| `app/api/admin/compliance/audit/route.ts` | **V3** GET — query compliance audit log |
| `app/api/admin/compliance/gdpr-export/route.ts` | **V3** POST — RGPD data export |
| `app/api/admin/compliance/gdpr-delete/route.ts` | **V3** POST — RGPD right to be forgotten |
| `supabase/migrations/20260513_suppression_list.sql` | Migration v1 — tables, indexes, RLS, `is_suppressed()` |

---

## Database Tables

### `suppression_list`

```sql
id UUID PK
email TEXT                    -- nullable (if domain-level block)
email_domain TEXT             -- nullable (if email-level block)
reason TEXT NOT NULL           -- unsubscribe|hard_bounce|soft_bounce_threshold|complaint|manual_block|gdpr_request|fraud_flag
source TEXT                   -- manually|unsubscribe_link|instantly_webhook|import|api
metadata JSONB                -- extra context
added_at TIMESTAMPTZ          -- when added
added_by UUID                 -- admin user who added (null for automated)
expires_at TIMESTAMPTZ        -- null = permanent

CHECK (email IS NOT NULL OR email_domain IS NOT NULL)
UNIQUE INDEX on lower(email)
INDEX on email_domain
INDEX on (reason, added_at DESC)
```

### `unsubscribe_tokens`

```sql
id UUID PK
token_hash TEXT UNIQUE        -- sha256 of raw token (NEVER store raw)
email TEXT NOT NULL            -- email to unsubscribe
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ        -- 1 year from creation
used_at TIMESTAMPTZ           -- null = not yet used
source_campaign_id UUID       -- optional campaign reference

INDEX on token_hash WHERE used_at IS NULL
INDEX on email WHERE used_at IS NULL
```

---

## Unsubscribe Flow

```
1. Campaign email contains: /unsubscribe?t=<base64url_token>
   - Token = crypto.randomBytes(32).toString('base64url')
   - Only the sha256 hash is stored in DB
   - Email NEVER appears in the URL

2. User clicks link → app/unsubscribe/page.tsx
   - Client-side page, sends POST /api/unsubscribe { token }

3. API /api/unsubscribe:
   a. Hash the token → lookup token_hash in unsubscribe_tokens
   b. Validate: exists + not used + not expired
   c. If valid:
      - UPSERT into suppression_list (reason='unsubscribe', source='unsubscribe_link')
      - UPDATE influencers SET status='blocked' WHERE email matches
      - UPDATE unsubscribe_tokens SET used_at=now()
   d. Return 200

4. UI shows "You've been unsubscribed" or generic error
```

---

## Token Generation

```typescript
// lib/admin/unsubscribe-token.ts

generateUnsubscribeToken(email, campaignId?)
  → token = randomBytes(32).base64url
  → tokenHash = sha256(token).hex
  → INSERT unsubscribe_tokens { token_hash, email, expires_at: +1y }
  → returns raw token (for URL)

verifyUnsubscribeToken(token)
  → hash token → SELECT from unsubscribe_tokens WHERE hash matches
  → reject if: not found, used_at set, expired
  → returns { email, tokenId }

markTokenUsed(tokenId)
  → UPDATE used_at = now()
```

---

## Check Suppression (Pre-Export)

```typescript
// lib/admin/check-suppression.ts

filterSuppressed(emails: string[])
  → Query suppression_list for matching emails (case-insensitive)
  → Query suppression_list for matching domains
  → Returns { allowed: string[], suppressed: { email, reason }[] }

isSuppressed(email: string)
  → Convenience wrapper, returns boolean
```

**Usage pattern (before any campaign export):**
```typescript
import { filterSuppressed } from '@/lib/admin/check-suppression'

const { allowed, suppressed } = await filterSuppressed(recipientEmails)
// Only send to `allowed`, log `suppressed` for audit
```

---

## Admin API

### GET /api/admin/suppression

Query params: `page`, `limit`, `reason`, `search`

Returns:
```json
{
  "data": {
    "entries": [...],
    "total": 1234,
    "page": 1,
    "limit": 50,
    "stats": { "total": 1234, "this_week": 42, "top_reasons": [...] }
  }
}
```

### POST /api/admin/suppression

Body:
```json
{
  "entries": [
    { "email": "spam@example.com", "reason": "manual_block" },
    { "email_domain": "bad-domain.com", "reason": "fraud_flag" }
  ]
}
```

Returns: `{ "data": { "added": 5, "total_requested": 7 } }`

### DELETE /api/admin/suppression

Body: `{ "id": "uuid" }`

---

## Admin Page Layout

```
1. Header — ShieldBan icon + "Suppression List" + CAN-SPAM/CASL/GDPR subtitle
2. Action buttons — "Bulk Add" + "Add Entry"
3. Stats row — Total Suppressed | This Week | Top Reason | Top Count
4. Error card (if error)
5. SuppressionTable:
   ├── Search bar (email/domain)
   ├── Reason filter pills (All | Unsubscribe | Hard Bounce | ... )
   ├── Table: Email/Domain | Reason | Source | Added | Actions(Remove)
   └── Pagination (prev/next)
6. Add Single Dialog — email input + reason pills
7. Bulk Add Dialog — textarea + reason pills + validation feedback
```

---

## Security Invariants

- Email NEVER appears in unsubscribe URL (only opaque token)
- Raw token NEVER stored in DB (only sha256 hash)
- Tokens are single-use (used_at prevents reuse)
- Tokens expire after 1 year
- Unsubscribe page is PUBLIC (no auth required — CAN-SPAM mandates 1-click)
- Admin suppression page requires admin auth (via withAdmin middleware)
- RLS enabled on both tables — all access via service role (admin client)
- `filterSuppressed()` MUST be called before every campaign export

---

## SQL Functions

```sql
-- Check single email (use in DB-level guards)
is_suppressed(p_email TEXT) → BOOLEAN

-- Stats for admin dashboard
get_suppression_stats() → JSON { total, this_week, top_reasons[] }
```

---

## Anti-Patterns (DO NOT)

- Put email in unsubscribe URL
- Store raw unsubscribe tokens
- Skip check_suppression before export
- Put unsubscribe behind auth
- Allow re-use of unsubscribe tokens
- Forget to mark influencer as blocked on unsubscribe
- Contact without source_url (provenance required)
- Send promo kit without FTC disclosure in caption

---

## V3 — 4-Way Suppression (Extended)

### New suppression_list columns

```sql
platform_handle TEXT     -- @username on a platform
profile_url TEXT         -- full profile URL
platform TEXT            -- twitch, kick, youtube, tiktok, etc.

INDEX on (lower(platform_handle), platform) WHERE platform_handle IS NOT NULL
INDEX on profile_url WHERE profile_url IS NOT NULL
```

### `is_suppressed_4way()` Postgres function

```sql
is_suppressed_4way(p_email, p_handle, p_profile_url, p_platform) → BOOLEAN
```

Checks ANY of:
1. email match (case-insensitive)
2. email_domain match
3. platform_handle + platform match
4. profile_url match

Respects `expires_at` (null = permanent).

### TypeScript usage

```typescript
import { isSuppressed4Way, filterSuppressed4Way } from '@/lib/admin/compliance/suppression-check'

// Single check
const blocked = await isSuppressed4Way({ email, handle, profileUrl, platform })

// Batch check (import flow)
const { allowed, suppressed } = await filterSuppressed4Way(contacts)
```

---

## V3 — Master Contact Validator

```typescript
import { validateContact } from '@/lib/admin/compliance/contact-validator'

const result = await validateContact({
  email: 'user@example.com',
  handle: 'username',
  platform: 'twitch',
  profileUrl: 'https://twitch.tv/username',
  sourceUrl: 'https://source.com/where-we-found-them',
  intent: 'send_email',  // 'import' | 'export_campaign' | 'send_email' | 'add_to_kit'
})

// result = { allowed: boolean, blocks: string[], warnings: string[] }
```

Rules enforced:
1. **NO source_url = NO contact** (except import intent)
2. **4-way suppression** (email + domain + handle + profile_url)
3. **Email required** for send_email intent

All blocks are logged to `compliance_audit_log`.

---

## V3 — FTC Disclosure Checker

```typescript
import { captionHasDisclosure, validateCaptionForKit } from '@/lib/admin/compliance/disclosure-checker'

const hasDisclosure = captionHasDisclosure(caption) // boolean
const result = validateCaptionForKit(caption) // { valid, reason?, suggestion? }
```

Required keywords: #ad, #sponsored, affiliate, partner, use code, etc.

---

## V3 — Compliance Audit Log

### `compliance_audit_log` table

```sql
id UUID PK
action TEXT               -- 11 action types (see below)
target_type TEXT           -- 'contact', 'influencer', etc.
target_id UUID
details JSONB
triggered_by UUID
occurred_at TIMESTAMPTZ
```

Action types:
- `contact_blocked_no_source` — provenance missing
- `contact_blocked_suppressed` — 4-way suppression match
- `contact_blocked_no_email` — email required but missing
- `caption_blocked_no_disclosure` — FTC disclosure missing
- `contact_imported_with_source` — successful import
- `suppression_added` / `suppression_removed`
- `gdpr_export_requested` / `gdpr_delete_requested`
- `unsubscribe_processed`
- `contact_validated_ok` — passed all checks

---

## V3 — GDPR APIs

### POST /api/admin/compliance/gdpr-export
Body: `{ email }`
Returns: All data for that email (influencer, messages, events, clicks, suppression)
Downloads as JSON file.

### POST /api/admin/compliance/gdpr-delete
Body: `{ email, confirm: true }`
Deletes: influencer + messages + events + clicks + sessions
Auto-adds email to suppression_list (prevent re-contact).

---

## V3 — Compliance Dashboard

```
/dashboard/admin/compliance

1. Header — ShieldCheck icon + "Compliance" + CAN-SPAM/CASL/GDPR/FTC subtitle
2. Stats — Total Suppressed | Blocks Today | Blocks This Week | GDPR Requests
3. Two columns:
   Left: Recent Blocks (last 10)
   Right: GDPR Requests (export/delete form)
4. Audit Log — filterable by action type, searchable
```

---

## V3 — Webhook Auto-Actions

When Instantly webhook fires:
- `email_bounced` → suppression_list entry includes: email + email_domain + platform_handle + profile_url + platform (from influencer CRM)
- `email_unsubscribed` → same 4-way suppression entry

---

## V3 — Import Flow Integration

`app/api/admin/influencers/import/route.ts` now uses `filterSuppressed4Way()` which checks all 4 dimensions (email + domain + handle + profile_url) instead of email-only.
