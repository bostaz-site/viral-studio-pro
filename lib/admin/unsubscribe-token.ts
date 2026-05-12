import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Generate a signed unsubscribe token for an email.
 * Only the hash is stored in DB — the raw token goes into the URL.
 */
export async function generateUnsubscribeToken(
  email: string,
  campaignId?: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const supabase = createAdminClient()
  const { error } = await supabase.from('unsubscribe_tokens').insert({
    token_hash: tokenHash,
    email: email.toLowerCase(),
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    source_campaign_id: campaignId ?? null,
  })

  if (error) throw new Error(`Failed to create unsubscribe token: ${error.message}`)

  return token // used in URL: /unsubscribe?t=<token>
}

/**
 * Verify an unsubscribe token and return the associated email.
 * Returns null if token is invalid, expired, or already used.
 */
export async function verifyUnsubscribeToken(
  token: string,
): Promise<{ email: string; tokenId: string } | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('unsubscribe_tokens')
    .select('id, email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .single()

  if (error || !data) return null
  if (data.used_at) return null
  if (new Date(data.expires_at) < new Date()) return null

  return { email: data.email, tokenId: data.id }
}

/**
 * Mark a token as used (one-time use).
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId)
}
