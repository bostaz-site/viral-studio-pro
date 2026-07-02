import { createAdminClient } from '@/lib/supabase/admin'

const ATTRIBUTION_WINDOW_DAYS = 60

/**
 * Attribute a newly signed-up user to an influencer.
 * Checks: 1) cookie-based affiliate_code, 2) fingerprint match in affiliate_clicks.
 * Creates an affiliate_referrals row on match.
 */
export async function attributeSignup(params: {
  userId: string
  affiliateCode?: string | null
  fingerprintHash?: string | null
  ipHash?: string | null
}): Promise<{ influencerId: string; attributionType: string } | null> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let influencerId: string | null = null
  let attributionType = 'cookie'

  // 1. Try cookie-based attribution (affiliate_code → influencer)
  if (params.affiliateCode) {
    const { data: influencer } = await supabase
      .from('influencers')
      .select('id')
      .eq('affiliate_code', params.affiliateCode)
      .maybeSingle()

    if (influencer) {
      influencerId = influencer.id
      attributionType = 'cookie'
    }
  }

  // 2. Fallback: fingerprint match in affiliate_clicks (last 60 days)
  if (!influencerId && params.fingerprintHash) {
    const { data: click } = await supabase
      .from('affiliate_clicks')
      .select('influencer_id')
      .eq('fingerprint_hash', params.fingerprintHash)
      .gte('clicked_at', cutoff)
      .not('influencer_id', 'is', null)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (click?.influencer_id) {
      influencerId = click.influencer_id
      attributionType = 'fingerprint'
    }
  }

  // 3. Fallback: IP hash match (weaker signal)
  if (!influencerId && params.ipHash) {
    const { data: click } = await supabase
      .from('affiliate_clicks')
      .select('influencer_id')
      .eq('ip_hash', params.ipHash)
      .gte('clicked_at', cutoff)
      .not('influencer_id', 'is', null)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (click?.influencer_id) {
      influencerId = click.influencer_id
      attributionType = 'ip_match'
    }
  }

  if (!influencerId) return null

  // Create affiliate_referrals row
  const { error } = await supabase.from('affiliate_referrals').insert({
    influencer_id: influencerId,
    user_id: params.userId,
    attribution_type: attributionType,
    status: 'attributed',
    attribution_metadata: {
      affiliate_code: params.affiliateCode ?? null,
      fingerprint_hash: params.fingerprintHash ?? null,
      ip_hash: params.ipHash ?? null,
    } as Record<string, string | null>,
  })

  if (error) {
    // Duplicate user_id — already attributed
    if (error.code === '23505') return null
    console.error('[Attribution] Failed to insert referral:', error.message)
    return null
  }

  // Mark affiliate_clicks as converted
  if (params.affiliateCode) {
    await supabase
      .from('affiliate_clicks')
      .update({
        signup_user_id: params.userId,
        signup_completed_at: new Date().toISOString(),
      })
      .eq('affiliate_code', params.affiliateCode)
      .is('signup_user_id', null)
      .order('clicked_at', { ascending: false })
      .limit(1)
  }

  // Log activation event
  await supabase.from('product_activation_events').insert({
    user_id: params.userId,
    event_name: 'user_signed_up',
    referred_by_influencer_id: influencerId,
    metadata: { attribution_type: attributionType } as Record<string, string>,
  })

  return { influencerId, attributionType }
}
