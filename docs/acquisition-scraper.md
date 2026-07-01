# Acquisition — Lead Scraper + AI Scoring + CRM Import

## What It Does

YouTube Data API scraper that discovers influencer leads, scores them with Claude Haiku, and imports them into the CRM (`influencers` table).

Pipeline: **YouTube search → email extraction → keyword scoring → AI scoring (Haiku) → CRM import**

## Current State: BUILT BUT NEVER USED

- 0 leads discovered in production
- 0 AI scoring jobs completed
- 0 imports into `influencers` table
- The UI renders, the API routes respond, the DB tables exist — but the pipeline has never run end-to-end

## Architecture

### UI Pages
- `/admin/scraper` — Search form, results table, saved searches (tabs: YouTube live, TikTok/Google/Instagram stubs)
- `/admin/ai-scoring` — Scoring jobs dashboard, stats
- `/admin/influencers/import` — 4-step CSV import wizard
- `/admin/influencers/imports` — Import batch history

### Code
- `lib/admin/scraper/youtube.ts` — YouTube Data API v3 (channel search + email extraction from description)
- `lib/admin/scraper/keyword-scorer.ts` — Regex-based affiliate signal scoring (no AI, fast)
- `lib/admin/scraper/distributor-graph.ts` — Detects promoted products (OpusClip, Submagic, etc.)
- `lib/admin/scraper/quota-tracker.ts` — YouTube API quota monitoring (10k units/day free tier)
- `lib/admin/ai-scoring/batch-processor.ts` — Orchestrator (top 3% threshold, batch 10, $1/day cap)
- `lib/admin/ai-scoring/claude-scorer.ts` — Claude Haiku scoring (niche fit, audience, engagement, sentiment → 0-100)
- `lib/admin/ai-scoring/cost-tracker.ts` — Cost logging to `ai_calls` table

### API Routes
- `POST /api/admin/scraper/youtube` — Search + enrichment
- `POST /api/admin/scraper/import` — Bulk import to CRM (4-way suppression: email, domain, handle, profile_url)
- `GET /api/admin/scraper/quota` — Quota usage
- `POST /api/cron/ai-scoring` — Hourly cron (CRON_SECRET auth)
- `POST /api/admin/influencers/import` — CSV import with batches of 100

### Database Tables
- `lead_discovery_runs` — Scraper session tracking
- `lead_discovery_results` — Individual discovered profiles
- `public_contact_points` — Emails with provenance (source_url required)
- `affiliate_signal_snapshots` — Keyword + distributor scores
- `promoted_products` — Competitor product mentions
- `scraper_saved_searches`, `scraper_quota_usage`, `scraper_rate_limits`
- `high_intent_no_email` — High-score leads without public email
- `ai_scoring_jobs` — AI scoring batch tracking

## Known Bugs

### 1. Quote Characters in Search (FIXED in code, risk remains)
`lib/admin/scraper/youtube.ts` normalizes smart/curly quotes to ASCII, but users pasting from docs may still hit edge cases. No UI validation warns about special characters.

### 2. Email Extraction is YouTube-Only
Only extracts emails from YouTube channel `snippet.description` (free API field). No extraction from: TikTok bios, Instagram bios, website /contact pages, Linktree links. Other platforms are "Tier 2/3" stubs.

### 3. API Quota Ceiling
10k units/day free tier. Each search = 101 units (100 search + 1 channel details). Max ~100 searches/day, ~2500 leads/day. Scaling requires YouTube API quota upgrade (paid).

### 4. AI Scoring Never Triggered
Cron route exists, batch processor is ready, cost cap ($1/day) is in place — but 0 jobs have ever run because there are 0 unscored leads in the system.

## Dependencies
- **YouTube Data API** — YOUTUBE_API_KEY in .env (free tier, 10k units/day)
- **Claude Haiku** — ANTHROPIC_API_KEY, ~$0.003/lead, $1/day cap
- **Supabase** — 10 tables, service role for admin operations
