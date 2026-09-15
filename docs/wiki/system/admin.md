# Admin Growth Machine

CRM, scraper, campaigns, cold email, compliance. Admin-only (`withAdmin()`).

## Influencer CRM
Full pipeline: unqualified → qualified → contacted → interested → demo_sent → paying.
Table `influencers` (~60 columns). Lead scoring via Claude Haiku (`lib/admin/ai-scoring/`).

## YouTube Scraper
`POST /api/admin/scraper/youtube`: searches YouTube Data API, enriches channels (video descriptions, external links), extracts emails (3-source waterfall: channel → video descriptions → link crawling). Cross-run upsert (updates existing leads, doesn't skip). Default: `regionCode=US`, `relevanceLanguage=en`.

Email blocklist: competitor domains (opus.pro, zapcap.ai, submagic.co, etc.) + fake TLDs (.png, .jpg). DB errors surfaced in response (`db_errors`, `db_error_messages`).

## Cold Email System
Templates in `email_templates` with `sequence_id`, `step_number`, `delay_days`. Current sequence: `cold-v1` (3 steps: day 0/3/8 + welcome template).

`POST /api/admin/campaigns/create-sequence`: loads templates, runs compliance preflight (footer, bounce rate), creates Instantly campaign. Tracking: opens OFF, clicks OFF step 1 / ON steps 2-3, stop-on-reply.

## Auto-Onboarding (`lib/admin/onboarding/auto-onboard.ts`)
Triggered when influencer status → 'interested' (via Instantly webhook reply classifier):
1. Generate affiliate code
2. Generate magic link → partner portal
3. Pick demo video by niche
4. Compose welcome email from template
5. Save as draft (review mode) or send (auto mode)
6. Update status → 'demo_sent'

Mode: `distribution_settings.auto_onboard_mode` ('review'|'auto', default 'review').

## Compliance (`lib/admin/compliance/`)
GDPR export/delete, FTC disclosure, provenance enforcer. Suppression list checked before every send.

## Key files
- `app/api/admin/scraper/youtube/route.ts` — search + results
- `app/api/admin/campaigns/create-sequence/route.ts` — Instantly campaign creation
- `lib/admin/onboarding/auto-onboard.ts` — interested → welcome pipeline
- `lib/admin/ai/reply-classifier.ts` — Claude Haiku reply classification
- `lib/integrations/instantly/client.ts` — Instantly v2 API client
- `app/api/webhooks/instantly/route.ts` — reply webhook + auto-onboard trigger
