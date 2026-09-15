# System Reference: Admin Campaigns (v2.1)

> Source de verite pour le module Campaign Management (Cold Email Engine).
> Derniere mise a jour : 2026-07-01.

---

## Architecture -- Campaign Creation & Export

| Fichier | Role |
|---|---|
| `app/(dashboard)/admin/campaigns/page.tsx` | Page liste -- table campagnes, status, metrics, actions (pause/resume/archive) |
| `app/(dashboard)/admin/campaigns/new/page.tsx` | Page creation -- wizard 3 etapes (form, recipients, export) |
| `app/(dashboard)/admin/campaigns/[id]/page.tsx` | Page detail -- info, metrics, recipient breakdown, export history |
| `app/(dashboard)/admin/campaigns/_components/campaign-form.tsx` | Formulaire creation -- name, description, niches, platforms, subject/body templates |
| `app/(dashboard)/admin/campaigns/_components/recipient-selector.tsx` | Selecteur influencers -- filtres (status, niche, platform, audience, country, search), preview count |
| `app/(dashboard)/admin/campaigns/_components/export-preview.tsx` | Preview export -- suppression check, dedup, export to Instantly, download CSV |
| `app/api/admin/campaigns/route.ts` | API GET (list) + POST (create) campagnes |
| `app/api/admin/campaigns/[id]/route.ts` | API GET (detail + recipients + exports) + PATCH (status/info update) |
| `app/api/admin/campaigns/[id]/export/route.ts` | API POST -- export CSV with suppression check, campaign_recipients insert, Storage upload |
| `app/api/admin/campaigns/[id]/preview/route.ts` | API POST -- compute export preview (suppression + dedup) sans modifier la DB |
| `app/api/admin/influencers/search/route.ts` | API GET -- search influencers with filters (pour recipient selector) |
| `lib/admin/campaigns/csv-generator.ts` | CSV generation, unsubscribe token generation, export preview computation |
| `lib/supabase/admin-untyped.ts` | Supabase admin client sans types (pour tables admin non encore dans types.ts) |

---

## Flow Creation Campagne (Wizard 3 etapes)

```
Step 1: Campaign Details
  - Name (required), Description
  - Target niches (multi-select pills), Target platforms (multi-select pills)
  - Subject template (with {{first_name}}, {{display_name}} variables)
  - Body template (with {{unsubscribe_token}} for compliance)
  --> POST /api/admin/campaigns --> creates draft campaign

Step 2: Select Recipients
  - Filters: status, niche, platform, audience min/max, country, search
  - Server-side search via GET /api/admin/influencers/search
  - Shows "X influencers match" count, click rows to select
  --> Client state: selectedIds[]

Step 3: Review & Export
  - "Check Suppression" --> POST /api/admin/campaigns/[id]/preview
  - Shows: X selected, Y suppressed, Z duplicates, W will export
  - "Export to Instantly" --> POST /api/admin/campaigns/[id]/export
  - Result: CSV download link + storage path + summary
```

---

## CSV Format (Instantly)

```csv
email,first_name,last_name,display_name,platform,niche,audience_size,custom_var_1,unsubscribe_token
```

- `custom_var_1` = influencer UUID (for tracking)
- `unsubscribe_token` = unique 32-byte base64url token, stored hashed in `unsubscribe_tokens`
- Token hash stored via SHA-256, original token never stored
- Token expires after 1 year

---

## Export Flow (Suppression-Aware)

```
1. Validate campaign exists + status = 'draft'
2. computeExportPreview: suppression_list check + unsubscribed check + dedup across active campaigns
3. Fetch full influencer data for allowed IDs
4. generateCampaignCsv: generate unsubscribe tokens (batches of 50), build CSV
5. INSERT campaign_recipients (batches of 500, skip on conflict)
6. Upload CSV to Storage: campaign-exports/{campaign_id}/recipients-{timestamp}.csv (PRIVATE)
7. Return signed download URL (1h expiry) + summary
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/campaigns` | List all campaigns |
| POST | `/api/admin/campaigns` | Create draft campaign |
| GET | `/api/admin/campaigns/[id]` | Detail + recipients + export files |
| PATCH | `/api/admin/campaigns/[id]` | Update status/name/description |
| POST | `/api/admin/campaigns/[id]/preview` | Compute export preview (read-only) |
| POST | `/api/admin/campaigns/[id]/export` | Full export: CSV + recipients + storage |
| GET | `/api/admin/influencers/search` | Search influencers with filters |

---

## Database Tables

- `email_campaigns` -- Campaign metadata + aggregated metrics
- `campaign_recipients` -- Tracks which leads are in which campaigns (UNIQUE campaign+influencer+step)
- `suppression_list` -- Global compliance list checked before every export
- `unsubscribe_tokens` -- URL-safe tokens for public unsubscribe page
- `email_templates` -- Reusable email templates with variables
- `email_sequences` -- Multi-step campaign sequences **(reservee/inutilisee — sequences gerees dans Instantly)**
- `mailboxes` -- Sender accounts (synced from Instantly)
- `mailbox_daily_stats` -- Daily health metrics per mailbox

---

## Anti-Patterns (Enforced)

- Never export without suppression_list check
- Never generate duplicate tokens (each export generates fresh tokens)
- All campaign_recipients status='queued' on insert
- CSV never in public bucket
- Export only allowed for draft campaigns

---

## Instantly Sync

## Instantly Sync

### How it works

An automated sync service pulls data from the Instantly API v2 every 15 minutes:

1. **Mailbox sync** — Fetches all email accounts from Instantly, upserts into `mailboxes` table (matched by email), creates daily stat rows in `mailbox_daily_stats`
2. **Campaign sync** — Fetches all active+paused campaigns, pulls analytics per campaign, upserts into `email_campaigns` (matched by `instantly_campaign_id`)
3. **Status tracking** — Sync results stored in `sync_log` table for the admin status page

### Files

| File | Purpose |
|------|---------|
| `lib/integrations/instantly/client.ts` | API v2 wrapper with pagination |
| `lib/integrations/instantly/types.ts` | TypeScript types for API + sync |
| `lib/integrations/instantly/sync.ts` | Main orchestrator |
| `lib/integrations/instantly/sync-mailboxes.ts` | Mailbox sync logic |
| `lib/integrations/instantly/sync-campaigns.ts` | Campaign sync logic |
| `app/api/cron/sync-instantly/route.ts` | Cron endpoint (x-api-key auth) |
| `app/api/admin/sync/instantly/route.ts` | Admin GET status / POST force-sync |
| `app/(dashboard)/admin/sync/page.tsx` | Sync status admin page |

### Env vars

- `INSTANTLY_API_KEY` — Server-only API key for Instantly v2
- `CRON_SECRET` — Shared secret for cron endpoint auth

### Cron schedule

Configured in `netlify.toml` comments, triggered externally:
```
POST /api/cron/sync-instantly — every 15min
```

### Admin page

Route: `/admin/sync`

Displays:
- Last sync time (relative) + success/error indicator
- Next scheduled sync time
- Mailbox count + average reputation score
- Campaign count + running count
- Sync error log
- Force sync button

### Data flow

```
Instantly API → sync-mailboxes.ts → mailboxes table
                                   → mailbox_daily_stats table

Instantly API → sync-campaigns.ts → email_campaigns table (metrics)

Both → sync.ts → sync_log table (status tracking)
```

### Field mapping

#### Mailboxes
| Instantly field | DB column |
|----------------|-----------|
| `id` | `instantly_account_id` |
| `email` | `email` |
| `first_name + last_name` | `display_name` |
| `daily_limit` | `daily_send_limit` |
| `warmup_status` | `status` (mapped) |

#### Campaigns
| Instantly field | DB column |
|----------------|-----------|
| `id` | `instantly_campaign_id` |
| `name` | `name` |
| `status` | `status` (mapped: active->running) |
| `analytics.emails_sent` | `total_sent` |
| `analytics.emails_read` | `total_opened` |
| `analytics.leads_replied` | `total_replied` |
| `analytics.bounced` | `total_bounced` |
| `analytics.unsubscribed` | `total_unsubscribed` |
| `analytics.total_leads` | `total_recipients` |

### Error handling

- Per-entity resilience: one failed mailbox/campaign doesn't block others
- All errors logged via pino and stored in sync result
- Rate limiting: 200-300ms delays between API calls
- Fatal errors (bad API key) stop sync but persist partial results

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **OFFER-GENERATOR** | Genere les offres personnalisees injectees dans les templates de campagne |
| **Instantly sync** | Synchronise mailboxes et metriques campagnes (cron `sync-instantly` toutes les 15 min) |
| **INBOX** | Les reponses aux campagnes arrivent dans l'inbox unifie pour triage |
| **COMPLIANCE** | Suppression list partagee — verifiee avant chaque export CSV |

---

## Mode degrade sans API key

> **Mode officiel de launch** : pas de cle API Instantly payante.

| Action | Comment |
|---|---|
| **Creer une campagne** | Wizard 3 etapes fonctionne normalement |
| **Exporter les recipients** | Export CSV manuel (download), import dans Instantly via l'UI web |
| **Gerer les sequences** | Directement dans Instantly (sequences, delays, A/B) |
| **Suivre les reponses** | Unibox Instantly (reponses, opens, clicks) |
| **Sync metriques** | Desactive — pas de `INSTANTLY_API_KEY` |

La cle API Instantly (plan superieur) sera achetee au launch si le volume le justifie.
Sans cle, le cron `sync-instantly` ne tourne pas et les metriques campagne restent vides cote admin.

---

## Sequence de reference

| Jour | Email | Objectif |
|---|---|---|
| **J0** | Kit | Pitch principal + lien repost kit + code promo |
| **J+2** | Bump zero-effort | Rappel court, zero friction ("just hit repost") |
| **J+5** | Audience fit | Angle personnalise audience ("your X followers would love...") |
| **J+9** | Close permission-based | Dernier email, permission-based ("should I stop reaching out?") |
| **J+16** *(optionnel)* | Reserved leads chauds | Uniquement si opened/clicked/kit_viewed — angle exclusivite |

> Les sequences sont configurees et executees dans Instantly, pas dans l'app.
