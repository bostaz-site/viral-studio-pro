# Kick HLS Proxy — Cloudflare Worker

Replaces the Netlify Edge Runtime proxy (`app/api/clips/kick-proxy/route.ts`) with a Cloudflare Worker for better global latency and no cold starts.

## What it does

Proxies Kick HLS video streams to bypass CORS restrictions:
1. Receives `?url={m3u8 or ts URL}` pointing to `clips.kick.com`
2. Fetches upstream, rewrites `.ts` segment references in playlists to route back through the worker
3. Streams `.ts` segments directly (no buffering)

## Security

Same SSRF protections as the Netlify version:
- Hostname whitelist: `clips.kick.com` only
- HTTPS only, no auth in URL, no explicit ports
- Path traversal rejection (`..`, `%25`)
- Extension whitelist: `.m3u8` and `.ts` only

Rate limiting is handled by Cloudflare's built-in rate limiting rules (configure in dashboard) instead of Upstash Redis.

## Deploy

```bash
cd workers/kick-proxy
npx wrangler deploy
```

## Migration steps

1. Deploy this worker to Cloudflare (`npx wrangler deploy`)
2. Note the worker URL (e.g. `https://kick-proxy.<account>.workers.dev`)
3. Update the frontend to use the worker URL instead of `/api/clips/kick-proxy`:
   - File: `components/trending/trending-card.tsx` (or wherever Kick video URLs are resolved)
   - Replace `/api/clips/kick-proxy?url=` with `https://kick-proxy.<account>.workers.dev?url=`
   - Or set `NEXT_PUBLIC_KICK_PROXY_URL` env var and use that
4. After confirming the worker handles all traffic, delete `app/api/clips/kick-proxy/route.ts`
5. Remove the `@upstash/redis` Edge import that was only used by the Kick proxy (if no other Edge routes use it)
