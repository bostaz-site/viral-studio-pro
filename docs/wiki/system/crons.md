# Cron Jobs

All Next.js API routes, auth via `x-api-key: CRON_SECRET` + `timingSafeCompare`.

## Active crons

| Cron | Route | Schedule | What it does |
|------|-------|----------|-------------|
| Rescore clips | `cron/rescore-clips` | stratified | Re-score trending clips (15min/1h/daily by age) |
| Fetch Twitch clips | `cron/fetch-twitch-clips` | ~15 min | Import new clips from followed streamers |
| Publish scheduled | `cron/publish-scheduled` | 5-10 min | Execute due autofarm publications with quality gates |
| Refresh post stats | `cron/refresh-post-stats` | 30 min | Update published_posts with platform metrics |
| Reset usage | `cron/reset-usage` | monthly | Reset monthly video quotas |
| Cleanup render jobs | `cron/cleanup-render-jobs` | daily | Clean zombie render jobs |
| Cleanup storage | `cron/cleanup-storage` | daily | Remove orphan files from Supabase Storage |
| AI triage | `cron/ai-triage` | daily | Auto-triage audit findings |
| AI scoring | `cron/ai-scoring` | daily | Batch score influencer leads |
| Sync Instantly | `cron/sync-instantly` | 15 min | Sync mailbox + campaign stats from Instantly |
| Watchdog | `cron/watchdog` | hourly | Anomaly detection on key metrics |
| Monthly payouts | `cron/monthly-payouts` | monthly | Calculate affiliate payouts |
| Resequence leads | `cron/resequence-leads` | daily | Move not_now leads back to cold after 60d — **NOT VERIFIED** (not yet added in cron-job.org) |

## Who triggers crons

All crons are HTTP POST requests to Next.js API routes, authenticated via `x-api-key: CRON_SECRET`. They are triggered by **cron-job.org** (external scheduler). The cron-job.org dashboard holds the schedule definitions and sends requests to the Netlify production URL. See `netlify.toml` comments for the full schedule list. To add a new cron: create the route, register it in `netlify.toml` comments, then add the job in cron-job.org.

## Watchdog checks (`lib/admin/watchdog/checks.ts`)
- Render success rate
- Publish success rate
- yt-dlp extractor health (dynamic clip probe, not hardcoded URL)
- Lab agent silence (gated by `LAB_AGENT_EXPECTED` env, default OFF)
- Supabase connection
- Storage usage

## Migration checker
`scripts/check-migrations.ts`: compares local `supabase/migrations/*.sql` against DB `schema_migrations`. Included in nightly audit.
