import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createKitSession(params: {
  influencerId: string
  campaignId?: string
  userAgent?: string
  ipHash?: string
}): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionToken = crypto.randomBytes(24).toString('base64url')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('repost_kit_sessions' as never)
    .insert({
      influencer_id: params.influencerId,
      campaign_id: params.campaignId ?? null,
      session_token: sessionToken,
      user_agent: params.userAgent ?? null,
      ip_hash: params.ipHash ?? null,
    } as never)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create kit session: ${error?.message}`)
  }

  return { sessionId: (data as { id: string }).id, sessionToken }
}

export async function getKitSession(sessionToken: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('repost_kit_sessions' as never)
    .select('id')
    .eq('session_token' as never, sessionToken as never)
    .single()

  return data ? (data as { id: string }).id : null
}
