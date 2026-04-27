// Cloudflare Worker — Kick HLS proxy
// Deploy: wrangler deploy
// Replaces: app/api/clips/kick-proxy/route.ts (Netlify Edge)

const ALLOWED_HOST = 'clips.kick.com'
const ALLOWED_EXTENSIONS = ['.m3u8', '.ts']

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    let parsed
    try { parsed = new URL(targetUrl) } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 })
    }

    // SSRF prevention
    if (parsed.hostname !== ALLOWED_HOST) {
      return new Response(JSON.stringify({ error: 'Only clips.kick.com allowed' }), { status: 403 })
    }
    if (parsed.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'HTTPS only' }), { status: 403 })
    }
    if (parsed.username || parsed.password || parsed.port) {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), { status: 403 })
    }
    if (targetUrl.includes('..') || targetUrl.includes('%25')) {
      return new Response(JSON.stringify({ error: 'Invalid URL path' }), { status: 403 })
    }

    const hasAllowedExt = ALLOWED_EXTENSIONS.some(ext => parsed.pathname.endsWith(ext))
    if (!hasAllowedExt) {
      return new Response(JSON.stringify({ error: 'Only .m3u8 and .ts allowed' }), { status: 403 })
    }

    const isPlaylist = parsed.pathname.endsWith('.m3u8')

    try {
      const upstream = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://kick.com/' }
      })

      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: 'Upstream failed' }), { status: upstream.status })
      }

      if (isPlaylist) {
        let body = await upstream.text()
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1)
        // Rewrite .ts references to route through this worker
        body = body.replace(/^(\d+\.ts)$/gm, (match) => {
          return `?url=${encodeURIComponent(baseUrl + match)}`
        })
        return new Response(body, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } else {
        return new Response(upstream.body, {
          headers: {
            'Content-Type': 'video/mp2t',
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Proxy failed' }), { status: 502 })
    }
  }
}
