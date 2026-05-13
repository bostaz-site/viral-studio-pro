import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const SESSION_DURATION_DAYS = 30

/**
 * Generate a magic link token for an influencer.
 * Stores the hash in partner_sessions, returns the raw token for the email link.
 */
export async function generateMagicLinkToken(influencerId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()
  await admin.from('partner_sessions').insert({
    influencer_id: influencerId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  })

  return token
}

/**
 * Verify a magic link token. Returns the session if valid, null otherwise.
 */
export async function verifyMagicLinkToken(token: string): Promise<{
  sessionId: string
  influencerId: string
  tokenHash: string
} | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()
  const { data: session } = await admin
    .from('partner_sessions')
    .select('id, influencer_id, expires_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  // Update last_used_at
  await admin
    .from('partner_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id)

  return {
    sessionId: session.id,
    influencerId: session.influencer_id,
    tokenHash,
  }
}
