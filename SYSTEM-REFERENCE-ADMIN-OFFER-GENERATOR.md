# SYSTEM REFERENCE — Offer Generator (v2 — Real Personalization)

> Source de verite pour le generateur d'offres personnalisees (email + repost kit link).
> Derniere mise a jour : 2026-07-02.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/offer-generator/variable-extractor.ts` | Build 13+ template variables per influencer (real data) |
| `lib/admin/offer-generator/template-renderer.ts` | {{var}} substitution engine |
| `lib/admin/offer-generator/subject-picker.ts` | A/B round-robin subject line selection |
| `lib/admin/offer-generator/compliance-preflight.ts` | validateContact() wrapper before generation |
| `lib/admin/offer-generator/repost-kit-url-builder.ts` | Build /partner/repost/[handle] URL |
| `lib/admin/offer-generator/instantly-pusher.ts` | Push drafted offers to Instantly |
| `app/api/admin/offer-generator/templates/route.ts` | GET list + POST create templates |
| `app/api/admin/offer-generator/generate/route.ts` | POST bulk generate offers (with needs_review flag) |
| `app/api/admin/offer-generator/preview/route.ts` | POST preview before send |
| `app/api/admin/offer-generator/offers/route.ts` | GET list generated offers |
| `app/api/admin/offer-generator/send/route.ts` | POST push to Instantly |
| `app/(dashboard)/admin/offer-generator/page.tsx` | Dashboard: templates, preview, offers list |

---

## 3 Key Personalized Variables (V2)

### `{{recent_topic}}` — Real video title
- **Source**: `influencers.recent_video_titles[0]` (JSONB array)
- **Pipeline**: Scraper `getRecentVideoDescriptions()` → `lead_discovery_results.recent_video_titles` → import copies to `influencers.recent_video_titles`
- **Cleaning**: strips 3+ consecutive emojis, truncates to 60 chars
- **Fallback**: `influencers.niche` or "content creation"

### `{{specific_compliment}}` — AI-generated
- **Source**: `influencers.ai_specific_compliment` (written by AI Scoring batch)
- **Pipeline**: Claude Haiku scores lead → returns `specific_compliment` field → batch-processor writes to `influencers.ai_specific_compliment`
- **Prompt constraint**: must be specific to the creator's actual content, never generic, match creator's language
- **Fallback**: "your recent video on [recent_topic] caught my eye" (if recent_topic is real) or "your [niche] content stands out" (double fallback)
- **Never**: "really solid content" or any generic placeholder

### `{{promoted_apps}}` — Distributor Graph data
- **Source**: `promoted_products` table (via `influencer_id`)
- **Pipeline**: Scraper `detectPromotedProducts()` → saved during import → queried at generation time
- **Format**: "OpusClip and Submagic" (joins up to 3 product names)
- **Fallback**: "clipping tools"

---

## needs_review Flag

When **both** `specific_compliment` AND `recent_topic` are fallbacks, the generated offer is flagged `needs_review = true`.

- Column: `generated_offers.needs_review BOOLEAN DEFAULT FALSE`
- Dashboard shows a "faible perso" badge on these offers
- Admin can review and manually edit before sending
- Prevents generic-looking emails from being sent automatically

---

## 13+ Template Variables

| Variable | Source | Fallback |
|---|---|---|
| `{{first_name}}` | influencer.first_name or display_name | handle |
| `{{full_name}}` | first + last | display_name or handle |
| `{{handle}}` | platform_handle or affiliate_code | email local part |
| `{{platform}}` | primary_platform | "social" |
| `{{follower_count_formatted}}` | audience_size formatted ("47K") | "0" |
| `{{niche}}` | influencer.niche | "content creation" |
| `{{recent_topic}}` | recent_video_titles[0] cleaned | niche |
| `{{specific_compliment}}` | ai_specific_compliment | built from recent_topic |
| `{{promoted_apps}}` | promoted_products table | "clipping tools" |
| `{{repost_kit_url}}` | /partner/repost/[handle] | — |
| `{{commission_rate}}` | "30%" | — |
| `{{projected_monthly_earning}}` | calculated from audience | "$5-20" |
| `{{affiliate_code}}` | influencer.affiliate_code | "" |

+ 4 static: signup_link, calendly, link, company

### Metadata (in variables_used, not rendered)
- `_is_recent_topic_fallback`: boolean — true if recent_topic is niche fallback
- `_is_compliment_fallback`: boolean — true if specific_compliment is not AI-generated
- `_ai_recommended_offer_angle`: string | null — from AI scoring, visible in admin preview

---

## Database Tables

### `offer_templates`
```
id UUID PK
name TEXT
subject_line_variants JSONB     -- ["Subject A", "Subject B", "Subject C"]
body_template TEXT               -- with {{variables}}
niche TEXT[]
audience_min INT, audience_max INT
language TEXT
total_sent/opens/replies/kit_views/posts INT
status: active | paused | archived
```

### `generated_offers`
```
id UUID PK
influencer_id UUID FK -> influencers
template_id UUID FK -> offer_templates
selected_subject_variant INT
rendered_subject TEXT, rendered_body TEXT
repost_kit_url TEXT
variables_used JSONB             -- includes _ai_recommended_offer_angle
passed_compliance BOOLEAN
compliance_blocks JSONB
needs_review BOOLEAN DEFAULT FALSE  -- true = low personalization
status: draft | queued | sent | opened | replied | posted | bounced | failed
generated_at, sent_at, opened_at, replied_at TIMESTAMPTZ
```

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
   b. Extract variables (real data from scraper + AI scoring + distributor graph)
   c. Check personalization quality:
      - Both compliment AND topic are fallbacks → needs_review = true
   d. Pick subject variant (round-robin A/B)
   e. Render subject + body
   f. INSERT generated_offers (status='draft', needs_review flag)
    |
    v
4. Summary: X generated, Y blocked, Z failed, W needs_review
5. Admin reviews needs_review offers before sending
6. Optional: "Send All" → push to Instantly
```

---

## Systemes Connexes

### Inputs (consomme)

| Source | Data | Via |
|--------|------|-----|
| **Scraper** (`lib/admin/scraper/youtube.ts`) | Video titles → `recent_video_titles` | `getRecentVideoDescriptions()` → `lead_discovery_results` → import → `influencers` |
| **AI Scoring** (`lib/admin/ai-scoring/`) | `ai_specific_compliment` + `ai_recommended_offer_angle` | Claude Haiku batch → `influencers.ai_specific_compliment` |
| **Distributor Graph** (`lib/admin/scraper/distributor-graph.ts`) | Promoted product names | `promoted_products` table, queried at generation time |
| **CRM** (`influencers` table) | Name, handle, niche, audience, email | Direct query |

### Outputs (produit)

| Target | Data | Via |
|--------|------|-----|
| **Campaigns** (`lib/admin/email/`) | Rendered offers → CSV export → Instantly | `instantly-pusher.ts` or manual CSV |
| **Partner Portal** (`app/partner/repost/[handle]`) | Repost kit URL per influencer | `repost-kit-url-builder.ts` → `{{repost_kit_url}}` |
| **Inbox** (`app/(dashboard)/admin/inbox/`) | Reply tracking via Instantly webhooks | Webhook → `email_messages` |

---

## Anti-Patterns

- Never skip compliance pre-flight
- Never hardcode subjects (always A/B)
- Never generate without template (require template_id)
- Never send without staging as draft first
- Never use random for A/B (round-robin for stats accuracy)
- Always include {{repost_kit_url}} with correct handle
- Never send needs_review offers without admin review
- Never use generic placeholders — fallback must still be specific

---

*Document version 2.0 — Juillet 2026*
*Migration: 20260702_offer_gen_personalization.sql*
