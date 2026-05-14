# SYSTEM REFERENCE — Offer Generator (v1)

> Source de verite pour le generateur d'offres personnalisees (email + repost kit link).
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/offer-generator/variable-extractor.ts` | Build 13 template variables per influencer |
| `lib/admin/offer-generator/template-renderer.ts` | {{var}} substitution engine |
| `lib/admin/offer-generator/subject-picker.ts` | A/B round-robin subject line selection |
| `lib/admin/offer-generator/compliance-preflight.ts` | validateContact() wrapper before generation |
| `lib/admin/offer-generator/repost-kit-url-builder.ts` | Build /partner/repost/[handle] URL |
| `lib/admin/offer-generator/instantly-pusher.ts` | Push drafted offers to Instantly |
| `app/api/admin/offer-generator/templates/route.ts` | GET list + POST create templates |
| `app/api/admin/offer-generator/generate/route.ts` | POST bulk generate offers |
| `app/api/admin/offer-generator/preview/route.ts` | POST preview before send |
| `app/api/admin/offer-generator/offers/route.ts` | GET list generated offers |
| `app/api/admin/offer-generator/send/route.ts` | POST push to Instantly |
| `app/(dashboard)/admin/offer-generator/page.tsx` | Dashboard: templates, preview, offers list |
| `app/(dashboard)/admin/offer-generator/_components/template-list.tsx` | Template cards with A/B stats |
| `app/(dashboard)/admin/offer-generator/_components/offer-preview.tsx` | Email preview with compliance badge |
| `app/(dashboard)/admin/offer-generator/_components/bulk-generate-modal.tsx` | Bulk generate with filters + results |

---

## Database Tables

### `offer_templates`
```
id UUID PK
name TEXT
description TEXT
subject_line_variants JSONB     -- ["Subject A", "Subject B", "Subject C"]
body_template TEXT               -- with {{variables}}
niche TEXT[]
audience_min INT, audience_max INT
language TEXT
ab_variant_label TEXT
total_sent/opens/replies/kit_views/posts INT
status: active | paused | archived
```

### `generated_offers`
```
id UUID PK
influencer_id UUID FK -> influencers
template_id UUID FK -> offer_templates
promo_video_id UUID (optional)
match_id UUID (optional)
selected_subject_variant INT
rendered_subject TEXT, rendered_body TEXT
repost_kit_url TEXT
variables_used JSONB
passed_compliance BOOLEAN
compliance_blocks JSONB
status: draft | queued | sent | opened | replied | posted | bounced | failed
generated_at, sent_at, opened_at, replied_at TIMESTAMPTZ
```

---

## 5 Seed Templates

| # | Name | Angle | Key Variable |
|---|---|---|---|
| 1 | Direct Affiliate Pitch | Straightforward affiliate offer | {{recent_topic}}, {{specific_compliment}} |
| 2 | Tools You Use | Targets tool promoters | {{promoted_apps}} |
| 3 | Side Hustle | Passive income focus | {{projected_monthly_earning}} |
| 4 | Already Promoting Apps | Distributor ecosystem | {{promoted_apps}} |
| 5 | Storyteller Short | Ultra-minimal, direct | {{affiliate_code}} |

Each template has 3 subject line variants for A/B testing.

---

## 13 Template Variables

| Variable | Source |
|---|---|
| `{{first_name}}` | influencer.first_name or display_name |
| `{{full_name}}` | first + last |
| `{{handle}}` | platform_handle or affiliate_code |
| `{{platform}}` | primary_platform |
| `{{follower_count_formatted}}` | "47K" format |
| `{{niche}}` | primary niche |
| `{{recent_topic}}` | from niche (TODO: last video title) |
| `{{specific_compliment}}` | AI-generated (TODO: Claude) |
| `{{promoted_apps}}` | from Distributor Graph (TODO) |
| `{{repost_kit_url}}` | /partner/repost/[handle] |
| `{{commission_rate}}` | "30%" |
| `{{projected_monthly_earning}}` | calculated from audience |
| `{{affiliate_code}}` | influencer.affiliate_code |

+ 4 static: signup_link, calendly, link, company

---

## Generation Flow

```
1. Admin selects template + filters leads
2. Click "Bulk Generate"
    |
    v
3. For each influencer:
   a. Compliance pre-flight (validateContact)
      - Skip if blocked (insert as status='failed')
   b. Extract 13 variables
   c. Pick subject variant (round-robin A/B)
   d. Render subject + body
   e. INSERT generated_offers (status='draft')
    |
    v
4. Summary: X generated, Y blocked, Z failed
5. Optional: "Send All" → push to Instantly
```

---

## A/B Testing

- Each template has 3 subject line variants
- Round-robin assignment: `index = total_sent % variants.length`
- Stats tracked per template: sent, opens, replies, kit_views, posts
- Preview shows all variants rendered

---

## Compliance Pre-Flight

Before generating ANY offer:
1. `validateContact()` checks:
   - Source URL exists (provenance)
   - 4-way suppression check
   - Email exists for send_email intent
2. If blocked → insert offer with `passed_compliance=false`, `status='failed'`
3. All blocks logged to `compliance_audit_log`

---

## API Routes

### GET /api/admin/offer-generator/templates
Query: `status` (active|paused|archived|all)
Returns: Template[]

### POST /api/admin/offer-generator/templates
Body: `{ name, subject_line_variants, body_template, niche?, ... }`

### POST /api/admin/offer-generator/generate
Body: `{ influencerIds: string[], templateId: string }`
Returns: `{ generated, blocked, failed, total }`

### POST /api/admin/offer-generator/preview
Body: `{ influencerId, templateId, subjectVariantIndex? }`
Returns: `{ compliance, variables, preview, allSubjectVariants }`

### GET /api/admin/offer-generator/offers
Query: `status`, `templateId`, `page`
Returns: `{ offers, total, stats: { draft, sent, blocked } }`

### POST /api/admin/offer-generator/send
Body: `{ offerIds: string[] }` (max 200)
Pushes to Instantly, marks as queued

---

## Dashboard Layout

```
Header: "Offer Generator" + Send Drafts button + Refresh
Stats: 3 cards (Drafts | Sent | Blocked)
Tabs: Templates | Generated Offers

Templates tab:
  Left: Template list with A/B stats (sent/opens/replies)
  Right: Preview (subject variants, body, compliance badge)
  Action: "Bulk Generate" button

Offers tab:
  Table: Influencer | Subject | Status | Compliance | Date
```

---

## Instantly Integration

- Offers are staged as `draft` first (never direct send)
- "Send" button pushes to Instantly via API
- If INSTANTLY_API_KEY not set, marks as `queued` for manual CSV export
- Webhook handlers update status on send/open/reply/bounce

---

## Anti-Patterns

- Never skip compliance pre-flight
- Never hardcode subjects (always A/B)
- Never generate without template (require template_id)
- Never send without staging as draft first
- Never use random for A/B (round-robin for stats accuracy)
- Always include {{repost_kit_url}} with correct handle

---

*Document version 1.0 — Mai 2026*
*Branch: feature/acquisition-v3-offer-generator*
