import { createHash } from 'crypto'

let _pepper: string | null = null

function getPepper(): string {
  if (_pepper) return _pepper
  const pepper = process.env.AFFILIATE_IP_PEPPER
  if (pepper) {
    _pepper = pepper
    return pepper
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AFFILIATE_IP_PEPPER must be set in production')
  }
  _pepper = 'dev-pepper-change-in-prod-32ch'
  return _pepper
}

/**
 * Hash IP with a server-side pepper. Never store raw IPs.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + getPepper()).digest('hex')
}
