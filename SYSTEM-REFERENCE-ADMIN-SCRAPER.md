# SYSTEM REFERENCE — Admin Scraper & Discovery Layer (v1.1)

> Source de verite pour le systeme de decouverte automatisee de distributeurs d'apps (affilies potentiels).
> Derniere mise a jour : 2026-05-24.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/admin/scraper/page.tsx` | Page principale — tabs YouTube/TikTok/Google/Instagram, search form, results, import |
| `app/(dashboard)/admin/scraper/_components/youtube-scraper-form.tsx` | Formulaire recherche YouTube + saved searches + filtre "Only with email" |
| `app/(dashboard)/admin/scraper/_components/discovery-results-table.tsx` | Table resultats — select, import bulk, status badges, filtre email, compteur email |
| `app/(dashboard)/admin/scraper/_components/quota-panel.tsx` | Barre quota YouTube API (10k units/jour) |
| `app/api/admin/scraper/youtube/route.ts` | POST search + GET results par run_id (supporte `has_email=true` filter) |
| `app/api/admin/scraper/import/route.ts` | POST bulk import vers CRM avec 4-way suppression |
| `app/api/admin/scraper/saved-searches/route.ts` | GET/POST saved searches |
| `app/api/admin/scraper/quota/route.ts` | GET quota usage |
| `app/api/admin/scraper/runs/route.ts` | GET discovery run history |
| `lib/admin/scraper/youtube.ts` | YouTube Data API v3 client (search + channel details + email extraction from description) |
| `lib/admin/scraper/keyword-scorer.ts` | Keyword pre-score — regex affiliate signals + email boost (+20) |
| `lib/admin/scraper/distributor-graph.ts` | Detect promoted products (OpusClip, Submagic, etc.) |
| `lib/admin/scraper/quota-tracker.ts` | Track + check remaining YouTube API quota |

---

## Pipeline

```
1. User enters query in YouTube tab (e.g. '"use code" AI tools creator')
   - Smart/curly quotes are auto-normalized to straight ASCII quotes
   - "Only with email" toggle filters results to contactable leads only
2. POST /api/admin/scraper/youtube
   a. Check quota remaining > 150 units
   b. Create lead_discovery_runs row (status=running)
   c. Call YouTube Data API v3 search (100 units) -> channel IDs
   d. Call YouTube Data API v3 channels (1 unit) -> full details
   e. Process channels in parallel batches of 5:
      - Extract emails from snippet.description via regex
      - Filter false positives (no-reply, file extensions, placeholder domains)
      - Detect is_business_contact (proximity to "business/contact/sponsor" keywords)
      - Keyword pre-score (+20 boost if email found)
      - Distributor graph detection (OpusClip, Submagic, etc.)
      - INSERT lead_discovery_results with email_source_url = profile URL
   f. Update run (status=completed, counts)
   g. Track quota usage

3. Results displayed in table with:
   - Channel name + handle + avatar
   - Subscriber count
   - Keyword score (color-coded, includes +20 email boost)
   - Email indicator (green check / red X)
   - "X / Y have email" counter
   - Email-only filter toggle (in form + in table)
   - Promoted products
   - Import status

4. User selects results -> "Import to CRM"
   POST /api/admin/scraper/import
   For each result:
   a. 4-way suppression check (email + domain)
   b. Duplicate check (handle + email)
   c. If no email -> high_intent_no_email bucket
   d. INSERT influencers + public_contact_points + promoted_products
   e. Update result status (imported/skipped/suppressed/duplicate)
```

---

## Email Extraction

Source: `lib/admin/scraper/youtube.ts` > `extractEmailsFromText()`

Extracts emails from YouTube channel `snippet.description` (free API field, no CAPTCHA).

### Regex
`/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g`

### False Positive Filters
- **Domain blacklist**: example.com, email.com, youremail.com, domain.com, test.com, sample.com
- **Local-part blacklist**: no-reply, noreply, do-not-reply, support, example, your, name, email, someone, user
- **File extension pattern**: .png@, .jpg@, .gif@, .svg@, .webp@, etc.
- **Specific**: support@youtube.com
- **Dedup**: same email never returned twice

### Business Contact Detection
If the 60-char context around the email contains: business, contact, inquir, collab, sponsor, booking, partnership, press, media, pr -> `isBusinessContact=true` (stored in `raw_data`).

### Storage
- `has_email`: boolean
- `email`: first valid email, lowercased (CITEXT on import)
- `email_source_url`: channel profile URL (REQUIRED — no source = no contact)

---

## Keyword Pre-Score (No AI, Fast)

```
Strong signals (+15 each, max 60):
  "use code", "promo code", "affiliate", "partner", "sponsored", "#ad"

Medium signals (+10 each):
  "link in bio", "tools i use", "apps i love", "discount", "collab", "review"

Multi-monetization (+15): 3+ links in profile
Linktree/Beacons detected (+10): linktr.ee, beacons.ai, stan.store, carrd.co
Email contactability boost (+20): lead has a valid email

Score capped at 100.
```

---

## Database Tables (10 new)

| Table | Role |
|---|---|
| `lead_discovery_runs` | Scraper session tracking (source, query, counts, status) |
| `lead_discovery_results` | Individual discovered profiles (platform, handle, score, email, products) |
| `public_contact_points` | Email + provenance (source_url REQUIRED) |
| `affiliate_signal_snapshots` | Keyword + distributor scores per lead |
| `promoted_products` | Competitor product mentions (OpusClip, Submagic, etc.) |
| `scraper_saved_searches` | Reusable search presets with quality metrics |
| `scraper_quota_usage` | Daily API quota tracking per source |
| `scraper_source_health` | Source availability monitoring |
| `scraper_rate_limits` | Per-endpoint rate limiting |
| `high_intent_no_email` | High-score leads without public email (DM bucket) |

---

## Distributor Graph

Detects mentions of competitor/related products in profile text:

| Product | Category | Bonus |
|---|---|---|
| OpusClip, Submagic, Captions AI, Vidyo.ai | Direct competitor | +20 |
| Descript, CapCut, Riverside | Adjacent tool | +15 |
| Notion, Canva, Loom, Buffer, Later | Productivity/social | +10 |
| "app review", "tool review", "best apps" | Generic signal | +5 |

---

## YouTube Data API

- Env var: `YOUTUBE_API_KEY`
- Quota: 10,000 units/day (free tier)
- Search: 100 units per call (max 25 results, default 15)
- Channel details: 1 unit per call (up to 50 IDs batched)
- Enrichment: parallel batches of 5 channels to avoid Netlify timeout (~26s limit)
- Strategy: ~100 searches/day = ~2,500 leads/day at cost of ~10,100 units

---

## Sidebar Navigation

Scraper link is in the admin sidebar section (`app/(dashboard)/layout.tsx`), between "AI Scoring" and "Webhooks", using the `Radar` icon.

---

## 4-Way Suppression Check (Import)

Before importing any lead:
1. `suppression_list WHERE email = lead.email`
2. `suppression_list WHERE email_domain = lead.email.split('@')[1]`
3. (Future) `suppression_list WHERE platform_handle = lead.handle`
4. (Future) `suppression_list WHERE profile_url = lead.url`

If matched -> `import_status='suppressed'`, skip import.

---

## Anti-Patterns (DO NOT)

- Save email without email_source_url (NO source = NO contact)
- Blacklist real email providers (gmail.com, outlook.com, etc.) — only blacklist placeholder domains
- Call Claude AI for scoring (that's V3 Week 2)
- Search vague queries (wastes quota)
- Expose YOUTUBE_API_KEY on client
- Import without suppression check
- Forget is_business_contact detection for emails near business keywords
- Set maxResults > 25 (Netlify timeout risk)
