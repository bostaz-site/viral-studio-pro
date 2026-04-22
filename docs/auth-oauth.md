# Auth & OAuth

## Description

Authentication is handled by Supabase Auth (email/password + magic link). On top of that, users can connect social accounts (TikTok, YouTube, Instagram) via OAuth to enable multi-platform publishing. Tokens are encrypted at rest with AES via `ENCRYPTION_SECRET`.

## SQL Tables

### `social_accounts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK -> profiles.id |
| platform | TEXT | 'tiktok' / 'youtube' / 'instagram' |
| platform_user_id | TEXT | Platform-specific user ID |
| access_token | TEXT | AES-encrypted |
| refresh_token | TEXT | AES-encrypted, nullable |
| token_expires_at | TIMESTAMPTZ | Nullable (long-lived tokens have no expiry) |
| username | TEXT | Display name from platform |
| connected_at | TIMESTAMPTZ | When the account was connected |

## API Routes

### `GET /api/oauth/[platform]/authorize`

Initiates OAuth flow. Builds encrypted state (userId + nonce + platform + timestamp), base64url-encodes it, and redirects to the platform's authorization URL.

### `GET /api/oauth/[platform]/callback`

Handles the OAuth callback. Validates state (decrypts, checks platform match, checks 10-min expiry, verifies user is still authenticated). Exchanges authorization code for tokens via `exchangeCodeForTokens()`. Encrypts tokens and upserts into `social_accounts`.

- Redirects to `/settings?connected=[platform]` on success
- Redirects to `/settings?oauth_error=[message]` on failure

### `DELETE /api/oauth/[platform]/disconnect`

Protected via `withAuth`. Deletes the `social_accounts` row for the given user + platform.

**Response**: `{ platform, disconnected: true }`

### `GET /api/social-accounts`

Returns all connected social accounts for the authenticated user (used by the distribution store).

## Key Files

| File | Role |
|------|------|
| `lib/distribution/platforms.ts` | Platform configs (auth URLs, scopes, token endpoints) |
| `lib/distribution/token-manager.ts` | Token exchange, refresh, expiry checks |
| `lib/crypto.ts` | `safeEncrypt()` / `safeDecrypt()` (AES encryption) |
| `app/api/oauth/[platform]/authorize/route.ts` | OAuth authorize redirect |
| `app/api/oauth/[platform]/callback/route.ts` | OAuth callback handler |
| `app/api/oauth/[platform]/disconnect/route.ts` | Disconnect account |
| `components/distribution/connect-accounts.tsx` | UI for connecting/disconnecting |

## UI Components

### `ConnectAccounts`

Lists all 3 platforms (TikTok, YouTube, Instagram) with connect/disconnect buttons. Shows success/error banners from URL search params. Uses `useDistributionStore` for state.

**Props**: None (reads from store + search params)

## Zustand Stores

### `useDistributionStore` (`stores/distribution-store.ts`)

| Field | Type | Description |
|-------|------|-------------|
| accounts | SocialAccount[] | Connected social accounts |
| accountsLoading | boolean | Loading state |
| accountsError | string / null | Error message |
| fetchAccounts() | action | GET /api/social-accounts |
| disconnectAccount(platform) | action | DELETE /api/oauth/[platform]/disconnect |

## OAuth Flow

1. User clicks "Connect" on a platform card
2. Browser navigates to `GET /api/oauth/[platform]/authorize`
3. Server builds encrypted state (userId + nonce + platform + timestamp)
4. Server redirects to platform's OAuth page (TikTok / Google / Facebook)
5. User authorizes on the platform
6. Platform redirects to `GET /api/oauth/[platform]/callback?code=...&state=...`
7. Server validates state (decrypt, check platform match, check 10-min expiry)
8. Server exchanges code for tokens via platform-specific token endpoint
9. Server encrypts access + refresh tokens with AES
10. Server upserts into `social_accounts` table
11. Redirects to `/settings?connected=[platform]`

## Platform Configs

| Platform | Auth URL | Token URL | Scopes |
|----------|----------|-----------|--------|
| TikTok | `tiktok.com/v2/auth/authorize/` | `open.tiktokapis.com/v2/oauth/token/` | user.info.basic, video.publish, video.upload, video.list |
| YouTube | `accounts.google.com/o/oauth2/v2/auth` | `oauth2.googleapis.com/token` | youtube.upload, youtube.readonly |
| Instagram | `facebook.com/v21.0/dialog/oauth` | `graph.facebook.com/v21.0/oauth/access_token` | instagram_basic, instagram_content_publish, pages_read_engagement |

## Technical Notes

- State is encrypted with AES and base64url-encoded for URL safety
- State expires after 10 minutes (CSRF protection)
- Tokens are encrypted before storage, decrypted on use
- Token refresh happens automatically via `getValidToken()` (5-min buffer before expiry)
- Instagram uses Facebook Login flow with short-lived -> long-lived token exchange
- Google does not rotate refresh tokens; TikTok may rotate them
- Instagram publish is stubbed (`supportsPublish: false`) -- marked "Coming Soon" in UI
