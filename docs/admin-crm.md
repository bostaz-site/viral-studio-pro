# Admin CRM — Influencer Lead Management

Version: 1.0 — 2026-07-02

## What It Does

Lead management cockpit for the influencer CRM pipeline. Browse, triage, and manage all influencer leads through 15 pipeline statuses. Predefined views surface the most urgent actions. Detail drawer shows full profile, engagement signals, email timeline, and quick status actions.

## Pages

### `/admin/influencers` — Lead List Cockpit

**Page**: `app/(dashboard)/admin/influencers/page.tsx`
**API**: `GET /api/admin/influencers/list` (paginated, 50/page)
**API**: `PATCH /api/admin/influencers/list` (bulk actions)

#### Table Columns
Checkbox, Name/Handle, Email (badge if missing), Platform, Audience, Niche, Status (colored badge), Score, Last contacted, Last reply, Source, Tags

#### Search
Searches across: email, display_name, platform_handle, first_name, last_name (case-insensitive)

#### Filters (manual mode, when no predefined view is active)
- Status (dropdown, single)
- Platform (dropdown, single)
- Has email (yes/no)
- Source (text)
- Score min (number 0-100)

#### Predefined Views (buttons, sorted by urgency)
1. **Replied — a traiter**: status=replied AND reply_reviewed=false, sorted by last_replied_at DESC
2. **Interested — follow-up du**: status=interested AND (next_follow_up_at <= now() OR null), sorted by next_follow_up_at ASC nulls first
3. **Top leads non contactes**: status=cold AND score>=70 AND email not null, sorted by lead_score DESC
4. **Sans reponse 5j+**: status=contacted AND last_sent_at < now()-5d AND has_replied=false, sorted by last_sent_at ASC
5. **High intent sans email**: email is null AND score>=70, sorted by lead_score DESC
6. **Importes 24h**: created_at > now()-24h, sorted by created_at DESC

#### Bulk Actions (when rows selected)
- Set status (dropdown with all 15 statuses)
- Add tag (prompt)
- Mark reply reviewed
- Block (sets status=blocked + adds email to suppression_list)

### Detail Drawer

**Component**: `app/(dashboard)/admin/influencers/_components/influencer-drawer.tsx`
**API**: `PATCH /api/admin/influencers/[id]` (single update)
**API**: `GET /api/admin/influencers/[id]/events` (email timeline)

Opens on row click, slides in from the right. Contains:

#### Quick Actions
Buttons: Interested, Declined, Block, Reply reviewed (if applicable)

#### Profile Info Grid
Email, Platform (+ external link), Audience, Niche, Country, Language, Lead Score, AI Score, Source, Created date

#### Engagement Signals
Badges for: Sent (count), Opened, Clicked, Replied, Bounced, Unsubscribed — each with icon and color coding

#### Editable Fields
- Status dropdown (15 statuses)
- Tags (add/remove)
- Next follow-up (datetime-local picker)
- Notes (textarea, manual save)

#### Email Timeline
Chronological reverse list of email_events for this influencer. Shows event type, timestamp, with icon + color per type (sent, delivered, opened, clicked, replied, bounced_hard, bounced_soft, unsubscribed, spam_complaint).

## Database

### Engagement Fields (Migration: `20260702_influencer_engagement_fields.sql`)

Added to `influencers` table:

| Column | Type | Purpose |
|--------|------|---------|
| has_opened | BOOLEAN | Denormalized: any email opened |
| has_clicked | BOOLEAN | Denormalized: any link clicked |
| has_replied | BOOLEAN | Denormalized: any reply received |
| has_bounced | BOOLEAN | Denormalized: any hard/soft bounce |
| has_unsubscribed | BOOLEAN | Denormalized: unsubscribed |
| last_sent_at | TIMESTAMPTZ | Last outbound email sent |
| last_opened_at | TIMESTAMPTZ | Last email opened |
| last_replied_at | TIMESTAMPTZ | Last reply received |
| last_contacted_at | TIMESTAMPTZ | Last contact attempt |
| next_follow_up_at | TIMESTAMPTZ | Scheduled follow-up date |
| reply_reviewed | BOOLEAN | Admin has reviewed the reply |

### Indexes
- `idx_influencers_replied_unreviewed`: partial on (last_replied_at DESC) WHERE status='replied' AND reply_reviewed=false
- `idx_influencers_followup_due`: partial on (next_follow_up_at ASC NULLS FIRST) WHERE status='interested'
- `idx_influencers_contacted_no_reply`: partial on (last_sent_at ASC) WHERE status='contacted' AND has_replied=false
- `idx_influencers_status_replied`: composite (status, last_replied_at DESC)
- `idx_influencers_status_followup`: composite (status, next_follow_up_at ASC NULLS FIRST)

### RLS
Same as existing influencers table — admin only via service role, no anon policies.

## Pipeline Statuses (15)

```
unqualified → cold → queued → contacted → opened → replied →
interested → demo_sent → evaluating → onboarded → active → paying
                                                          → dormant
                                       → declined
                                       → blocked
```

## Key Files

| File | Purpose |
|------|---------|
| `app/(dashboard)/admin/influencers/page.tsx` | Lead list cockpit |
| `app/(dashboard)/admin/influencers/_components/influencer-drawer.tsx` | Detail drawer |
| `app/api/admin/influencers/list/route.ts` | GET paginated list + PATCH bulk actions |
| `app/api/admin/influencers/[id]/route.ts` | PATCH single influencer |
| `app/api/admin/influencers/[id]/events/route.ts` | GET email timeline |
| `supabase/migrations/20260702_influencer_engagement_fields.sql` | Engagement columns |

## Important: Manual Changes Only

This page does MANUAL status/tag/notes changes only. It does NOT auto-update influencer statuses from email events — that logic belongs to the Instantly webhook sync pipeline (see `docs/acquisition-outreach.md`).
