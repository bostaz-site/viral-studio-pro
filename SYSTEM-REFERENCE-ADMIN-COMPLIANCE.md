# SYSTEM REFERENCE — Admin Compliance Layer (v1)

> Ce fichier est la source de verite pour le module Compliance (Suppression List + Unsubscribe).
> Derniere mise a jour : 2026-05-11.

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
| `lib/admin/check-suppression.ts` | `filterSuppressed(emails[])` + `isSuppressed(email)` — pre-export filtering |
| `supabase/migrations/20260513_suppression_list.sql` | Migration — tables, indexes, RLS, `is_suppressed()`, `get_suppression_stats()` |

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
