/**
 * SSRF prevention: this proxy could be abused to scan internal networks or
 * exfiltrate data if URL validation is lax. We enforce:
 * - Hostname whitelist (clips.kick.com only)
 * - HTTPS only (no http://, no protocol-relative)
 * - No auth in URL (user:pass@host)
 * - No explicit ports (host:8080)
 * - No path traversal (.. or double-encoded %)
 * - Extension whitelist (.m3u8, .ts)
 * - Rate limited per IP via Upstash Redis
 */
import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// Edge Runtime for minimal latency on proxy requests
export const runtime = 'edge'

const ALLOWED_HOST = 'clips.kick.com'
const ALLOWED_EXTENSIONS = ['.m3u8', '.ts']
const FETCH_TIMEOUT_MS = 10000
const MAX_RETRIES = 1
const RATE_LIMIT = 30
const RATE_WINDOW_SEC = 60

// Inline rate limiter for Edge Runtime (uses Upstash HTTP API directly)
async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const redis = Redis.fromEnv()
    const key = `rl:kick-proxy:${ip}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, RATE_WINDOW_SEC)
    return count <= RATE_LIMIT
  } catch {
    return true // fail-open
  }
}

export async function GET(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const allowed = await checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // SSRF: reject non-https
  if (!url.startsWith('https://')) {
    return NextResponse.json({ error: 'Only HTTPS URLs allowed' }, { status: 403 })
  }

  // SSRF: reject double-encoded or path traversal
  if (url.includes('..') || url.includes('%25')) {
    return NextResponse.json({ error: 'Invalid URL path' }, { status: 403 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // SSRF: reject auth in URL
  if (parsed.username || parsed.password) {
    return NextResponse.json({ error: 'URL must not contain credentials' }, { status: 403 })
  }

  // SSRF: reject explicit ports
  if (parsed.port) {
    return NextResponse.json({ error: 'URL must not specify a port' }, { status: 403 })
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    return NextResponse.json({ error: 'Only clips.kick.com URLs allowed' }, { status: 403 })
  }

  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => parsed.pathname.endsWith(ext))
  if (!hasAllowedExt) {
    return NextResponse.json({ error: 'Only .m3u8 and .ts files allowed' }, { status: 403 })
  }

  const isPlaylist = parsed.pathname.endsWith('.m3u8')

  try {
    const upstream = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://kick.com/',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Upstream fetch failed', status: upstream.status },
        { status: upstream.status }
      )
    }

    if (isPlaylist) {
      let body = await upstream.text()
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1)
      body = body.replace(/^(\d+\.ts)$/gm, (match) => {
        return `/api/clips/kick-proxy?url=${encodeURIComponent(baseUrl + match)}`
      })

      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } else {
      // Stream .ts segments directly - don't buffer in memory
      return new NextResponse(upstream.body, {
        headers: {
          'Content-Type': 'video/mp2t',
          'Content-Length': upstream.headers.get('Content-Length') ?? '',
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[kick-proxy] Error:', msg)
    const status = msg.includes('timed out') || msg.includes('abort') ? 504 : 502
    return NextResponse.json({ error: 'Proxy fetch failed', detail: msg }, { status })
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const res = await fetch(url, init)
    if (res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 500))
      return fetchWithRetry(url, init, retries - 1)
    }
    return res
  } catch (err) {
    if (retries > 0 && !(err instanceof DOMException && err.name === 'AbortError')) {
      await new Promise(r => setTimeout(r, 500))
      return fetchWithRetry(url, init, retries - 1)
    }
    throw err
  }
}
