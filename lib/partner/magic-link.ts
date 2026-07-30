import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const MAGIC_LINK_EXPIRY_MINUTES = 15
const SESSION_DURATION_DAYS = 30

/**
 * Generate a magic link token for an influencer.
 * The token expires in 15 minutes and is single-use.
 * On verification, it's consumed and a separate long-lived session is created.
 */
export async function generateMagicLinkToken(influencerId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()

  // Insert as a magic_link type entry (short-lived, single-use)
  await admin.from('partner_sessions').insert({
    influencer_id: influencerId,
    token_hash: tokenHash,
    session_type: 'magic_link',
    expires_at: new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  })

  return token
}

/**
 * Verify a magic link token. If valid:
 * 1. Consumes the magic link (deletes it — single-use)
 * 2. Creates a new long-lived session (30 days)
 * 3. Returns the new session info
 *
 * Returns null if the token is invalid, expired, or already used.
 */
export async function verifyMagicLinkToken(token: string): Promise<{
  sessionId: string
  influencerId: string
  tokenHash: string
} | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()

  // Find the magic link entry
  const { data: magicLink } = await admin
    .from('partner_sessions')
    .select('id, influencer_id, expires_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!magicLink) return null
  if (new Date(magicLink.expires_at) < new Date()) {
    // Expired — clean up
    await admin.from('partner_sessions').delete().eq('id', magicLink.id)
    return null
  }

  // Consume the magic link (single-use — delete immediately)
  const { data: deleted } = await admin
    .from('partner_sessions')
    .delete()
    .eq('id', magicLink.id)
    .eq('token_hash', tokenHash) // extra safety: ensure no race
    .select('id')

  // If delete returned nothing, the link was already consumed (race condition)
  if (!deleted || deleted.length === 0) return null

  // Create a new long-lived session
  const sessionToken = crypto.randomBytes(32).toString('base64url')
  const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex')

  const { data: session } = await admin
    .from('partner_sessions')
    .insert({
      influencer_id: magicLink.influencer_id,
      token_hash: sessionHash,
      session_type: 'session',
      expires_at: new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (!session) return null

  return {
    sessionId: session.id,
    influencerId: magicLink.influencer_id,
    tokenHash: sessionHash,
  }
}
