import { createHash } from 'crypto'

const PEPPER = process.env.AFFILIATE_IP_PEPPER ?? 'dev-pepper-change-in-prod-32ch'

/**
 * Hash IP with a server-side pepper. Never store raw IPs.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + PEPPER).digest('hex')
}
