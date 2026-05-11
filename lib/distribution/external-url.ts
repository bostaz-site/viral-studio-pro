import crypto from 'crypto'

/**
 * Helpers for the /api/clips/external proxy route.
 *
 * The proxy serves rendered clips VIA viralanimal.com (our verified domain)
 * instead of supabase.co (which TikTok refuses for PULL_FROM_URL uploads).
 *
 * URLs are HMAC-signed with the storage path + expiry timestamp to prevent
 * abuse. Tokens expire in 4 hours by default.
 */

export function generateExternalUrlHmac(
  path: string,
  exp: number,
  secret: string
): string {
  return crypto.createHmac('sha256', secret).update(`${path}:${exp}`).digest('hex')
}

export function buildSignedExternalUrl(
  storagePath: string,
  appUrl: string,
  ttlSeconds = 14400 // 4 hours
): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET not configured')
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = generateExternalUrlHmac(storagePath, exp, secret)
  const params = new URLSearchParams({
    path: storagePath,
    exp: String(exp),
    sig,
  })
  return `${appUrl}/api/clips/external?${params.toString()}`
}
