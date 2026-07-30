import { NextRequest } from 'next/server'

/**
 * Extract the real client IP from request headers.
 *
 * Priority:
 * 1. x-nf-client-connection-ip (Netlify-injected, cannot be spoofed by the client)
 * 2. Last element of x-forwarded-for (the entry added by the edge proxy, not the client)
 * 3. Fallback: 'unknown'
 *
 * NEVER use the FIRST element of x-forwarded-for — it's controlled by the client
 * (curl -H "X-Forwarded-For: fake") and makes rate limits trivially bypassable.
 */
export function getClientIp(req: NextRequest): string {
  // Netlify-specific: trusted header injected at the edge
  const netlifyIp = req.headers.get('x-nf-client-connection-ip')
  if (netlifyIp) return netlifyIp.trim()

  // Fallback: last hop in x-forwarded-for (added by the reverse proxy, not the client)
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }

  return 'unknown'
}
