# SYSTEM REFERENCE — Admin Scraper & Discovery Layer (v1.2)

> Source de verite pour le systeme de decouverte automatisee de distributeurs d'apps (affilies potentiels).
> Derniere mise a jour : 2026-07-01.

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
| `lib/admin/scraper/youtube.ts` | YouTube Data API v3 client (search + channel details + email extraction + video descriptions + URL extraction) |
| `lib/admin/scraper/link-crawler.ts` | Crawl external links (linktree, beacons, personal sites) to extract emails from HTML |
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
   e. Process channels in parallel batches of 5, with email enrichment waterfall:
      Step 1 — Channel description:
        - Extract emails from snippet.description via regex
        - Filter false positives: no-reply addresses, file-extension local parts (.png, .jpg), placeholder domains (example.com), **competitor/tool company domains** (opus.pro, zapcap.ai, submagic.co, veed.io, wondershare.com, capcut.com, etc.), **fake TLDs** (flags@2x.png-style matches rejected by domain TLD check)
        - Detect is_business_contact (proximity to "business/contact/sponsor" keywords)
      Step 2 — Video descriptions (if no email yet, max 15 channels/run):
        - Fetch uploads playlist + 10 latest video snippets (+3 API units)
        - Extract emails from each video description
        - Email in 3+ videos OR near business keywords → is_business_contact=true
      Step 3 — External link crawling (if still no email):
        - Extract URLs from all descriptions (channel + videos)
        - Classify: linktree (aggregators) / external_site / skip (social)
        - Fetch up to 3 links per channel (5s timeout, normal User-Agent)
        - Extract emails from HTML (first 50KB)
      Then:
        - Set email_source (priority: external_site > linktree > video_description > channel_description)
        - Compute contactability_score (90/80/70/60/0)
        - Keyword pre-score (+20 boost if email found)
        - Distributor graph detection (OpusClip, Submagic, etc.)
        - Cross-run dedup: if channel exists in `lead_discovery_results` (any run), UPDATE the existing row with new `run_id`, refreshed `audience_size`/`keyword_score`/`recent_video_titles`/`discovered_at`. Preserves user-curated fields: `email` (only overwritten if new email found), `import_status`, `influencer_id`, `niche`. If no existing row, INSERT. `duplicates` counter tracks updated rows. This ensures `GET ?run_id=` always returns all channels found.
        - Default search params: `relevanceLanguage=en`, `regionCode=US` (filters out non-English channels that relevanceLanguage alone lets through).
   f. Update run (status=completed, counts)
   g. Track quota usage
   h. Return enrichment_depth in response (number of channels deeply enriched)

3. Results loaded from DB via `GET /api/admin/scraper/youtube?run_id={run_id}` (returns ALL leads for the run, including channels that existed in previous runs). The POST response only contains inline `results` for newly inserted leads — the GET is the sole source of truth for the table. Separate `resultsLoading` state shows "Loading results…" during the GET fetch.
   Table displays:
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

## Email Extraction (3-Source Waterfall)

Source: `lib/admin/scraper/youtube.ts` > `extractEmailsFromText()`, `getRecentVideoDescriptions()`, `extractUrlsFromText()`, `classifyUrl()`
Crawler: `lib/admin/scraper/link-crawler.ts` > `crawlExternalLinksForEmails()`

Emails are searched in order until one is found:
1. **Channel description** — `snippet.description` (free API field, always checked)
2. **Video descriptions** — 10 latest videos via uploads playlist (+3 quota units, max 15 channels/run)
3. **External links** — crawl linktree/beacons/personal sites found in descriptions (max 3 links, 5s timeout)

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
Additionally, email found in 3+ video descriptions → auto-flagged `isBusinessContact`.

### Email Source Priority
When multiple sources find emails, the highest-priority source wins:

| Priority | `email_source` value | `contactability_score` | Meaning |
|---|---|---|---|
| 1 (best) | `external_site` | 90 | Found on personal/business website |
| 2 | `linktree` | 80 | Found on link aggregator (linktr.ee, beacons.ai, etc.) |
| 3 | `video_description` | 70 | Found in recent video descriptions |
| 4 | `channel_description` | 60 | Found in channel About/bio |
| — | `null` | 0 | No email found |

### Supported Link Aggregators (for `linktree` source)
linktr.ee, beacons.ai, carrd.co, stan.store, linkin.bio, bio.link, lnk.bio, allmylinks.com, campsite.bio, hoo.be, tap.bio

### Skipped Domains (not crawled)
youtube.com, twitter.com, x.com, instagram.com, facebook.com, tiktok.com, twitch.tv, discord.gg, discord.com, reddit.com, spotify.com, apple.com, amazon.com, google.com, bit.ly, t.co

### Storage
- `has_email`: boolean
- `email`: first valid email, lowercased (CITEXT on import)
- `email_source`: provenance of the email (`channel_description`, `video_description`, `linktree`, `external_site`)
- `email_source_url`: URL where email was found (profile URL for channel/video, actual link for external)
- `contactability_score`: 0-100, based on email source (separate from keyword_score)

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
- **Video enrichment: +3 units per channel** (channels contentDetails=1 + playlistItems=1 + videos snippet=1)
- Enrichment: parallel batches of 5 channels to avoid Netlify timeout (~26s limit)
- **Deep enrichment limit**: max 15 channels per run get video desc + link crawling (timeout budget)
- Worst-case cost per run: 101 (search+channels) + 15×3 (video enrichment) = **146 units**
- Strategy: ~68 searches/day with full enrichment = ~1,700 leads/day at cost of ~9,928 units

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

## Error Handling

- Every Supabase insert/update in the scraper pipeline checks `error` alongside `data`. Errors are counted (`db_errors`), capped at 3 messages, stored in `lead_discovery_runs.errors[]`, and returned in the POST response as `db_error_messages`.
- Front-end shows a toast if `new_leads + duplicates < total` and `db_errors > 0` — surfaces silent DB failures immediately.
- Run status set to `failed` if all channels had DB errors (0 saved).
- **Migration check**: `scripts/check-migrations.ts` compares `supabase/migrations/*.sql` against `schema_migrations` table. Exit code 1 if any missing. Included in nightly technical audit.

## Anti-Patterns (DO NOT)

- Save email without email_source and email_source_url (NO provenance = NO contact)
- Blacklist real email providers (gmail.com, outlook.com, etc.) — only blacklist placeholder domains + competitor tool domains (opus.pro, zapcap.ai, etc.)
- Call Claude AI for scoring (that's V3 Week 2)
- Search vague queries (wastes quota)
- Expose YOUTUBE_API_KEY on client
- Import without suppression check
- Forget is_business_contact detection for emails near business keywords
- Set maxResults > 25 (Netlify timeout risk)
- Use headless browser for link crawling (simple fetch only, 5s timeout)
- Crawl more than 3 external links per channel (diminishing returns + timeout)
- Mix up contactability_score with keyword_score (they are independent axes)
