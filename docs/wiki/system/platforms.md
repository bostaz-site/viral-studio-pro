# Platform Publishing

OAuth + publish flows for TikTok, YouTube, Instagram, Facebook.

## Platform status
| Platform | Status | OAuth flow | API |
|----------|--------|------------|-----|
| TikTok | ACTIVE | TikTok v2 auth | Direct Post + inbox fallback |
| YouTube | ACTIVE | Google OAuth (offline+consent) | Resumable upload |
| Instagram | GATED (META_PREVIEW_EMAILS) | Instagram Login | Container flow via graph.instagram.com |
| Facebook | GATED (META_PREVIEW_EMAILS) | Facebook Login for Business | Page video POST |

## Gating: META_PREVIEW_EMAILS
`lib/distribution/launch-platforms.ts`: `LAUNCH_ACTIVE_PLATFORMS = ['tiktok', 'youtube']`. Instagram/Facebook gated unless user email is in `META_PREVIEW_EMAILS` env var. Server-side check in authorize + publish routes. Client-side via `usePlatformAccess()` hook (polls `GET /api/me/platform-access`).

## OAuth (`lib/distribution/token-manager.ts`)
- **TikTok**: code → POST token endpoint → refresh_token rotates
- **YouTube**: code → POST → long-lived refresh_token (Google doesn't rotate). `access_type=offline&prompt=consent`
- **Instagram**: code → POST `api.instagram.com` (short-lived) → GET `graph.instagram.com/access_token?grant_type=ig_exchange_token` (60-day) → refresh via `ig_refresh_token`
- **Facebook**: code → short-lived → `fb_exchange_token` (long-lived) → GET `/me/accounts` → Page token (never expires, stored encrypted in platform_metadata)

Token refresh: `getValidToken()` checks expiry (5-min buffer), acquires Redis distributed lock, refreshes, updates DB. Failed refresh → account marked disconnected.

## Publish flows
- **TikTok**: `publishToTikTok()` — Direct Post (pull-from-URL). Falls back to inbox mode on permission error.
- **YouTube**: `publishToYouTube()` — resumable upload. Privacy: user-selectable (Public/Unlisted/Private, default Public).
- **Instagram**: `publishToInstagram()` — async two-phase. POST creates Reel container, returns immediately. Client polls `GET /api/publish/status?publicationId=` (one IG status check per call). When FINISHED → POST `/media_publish`.
- **Facebook**: `publishToFacebook()` — POST `/{page_id}/videos` with `file_url`. Synchronous, 8s timeout.

## Variant protection
Non-TikTok platforms: if no `render_variants` row exists for the platform, publish is BLOCKED with 400 error "No variant available". Prevents publishing identical base render across platforms (duplicate detection risk).

## Key files
- `lib/distribution/platforms.ts` — platform configs, OAuth URLs, scopes
- `lib/distribution/launch-platforms.ts` — active platforms + gating
- `lib/distribution/token-manager.ts` — token exchange, refresh, distributed lock
- `lib/hooks/use-platform-access.ts` — client-side gating hook
- `app/api/publish/[platform]/route.ts` — publish endpoint
- `app/api/publish/status/route.ts` — Instagram async polling
- `app/api/oauth/[platform]/authorize/route.ts` — OAuth redirect
- `app/api/oauth/[platform]/callback/route.ts` — token exchange + upsert
