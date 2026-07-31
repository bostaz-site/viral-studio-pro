import crypto from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const COOKIE_NAME = 'va_partner_session'
const SESSION_DURATION_DAYS = 30

interface PartnerSession {
  sessionId: string
  influencerId: string
}

/**
 * Create a new session cookie for an authenticated partner.
 */
export async function createPartnerSession(
  influencerId: string,
  ipHash?: string,
  userAgent?: string
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')

  const admin = createAdminClient()
  await admin.from('partner_sessions').insert({
    influencer_id: influencerId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    ip_address_hash: ipHash ?? null,
    user_agent: userAgent ?? null,
  })

  return sessionToken
}

/**
 * Set the partner session cookie.
 */
export async function setPartnerCookie(sessionToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sessionToken, {
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })
}

/**
 * Get the current partner session from cookie.
 * Returns null if no valid session.
 */
export async function getPartnerSession(): Promise<PartnerSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()
  const { data: session } = await admin
    .from('partner_sessions')
    .select('id, influencer_id, expires_at')
    .eq('token_hash', tokenHash)
    .eq('session_type' as never, 'session')
    .single()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  // Touch last_used_at (fire-and-forget)
  void admin
    .from('partner_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id)

  return {
    sessionId: session.id,
    influencerId: session.influencer_id,
  }
}

/**
 * Require a valid partner session or return null.
 * For use in API routes.
 */
export async function requirePartnerAuth(): Promise<{
  influencerId: string
  influencer: {
    id: string
    email: string
    first_name: string | null
    display_name: string | null
    affiliate_code: string | null
    status: string
  }
} | null> {
  const session = await getPartnerSession()
  if (!session) return null

  const admin = createAdminClient()
  const { data: influencer } = await admin
    .from('influencers')
    .select('id, email, first_name, display_name, affiliate_code, status')
    .eq('id', session.influencerId)
    .single()

  if (!influencer) return null
  if (!['onboarded', 'active', 'paying'].includes(influencer.status)) return null

  return { influencerId: session.influencerId, influencer }
}

/**
 * Clear the partner session cookie.
 */
export async function clearPartnerCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
