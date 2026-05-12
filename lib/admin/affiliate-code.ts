import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * Generate a unique affiliate code for an influencer.
 * Format: 'va-' + handle (if available) or 'va-' + 6 random alphanumeric chars.
 * Checks uniqueness against influencers.affiliate_code.
 */
export async function generateAffiliateCode(
  influencerId: string,
  handle?: string | null,
): Promise<string> {
  const supabase = createAdminClient()

  // Try handle-based code first
  if (handle) {
    const candidate = `va-${handle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`
    const { data: existing } = await supabase
      .from('influencers')
      .select('id')
      .eq('affiliate_code', candidate)
      .maybeSingle()

    if (!existing) return candidate
  }

  // Fallback: random 6-char code with uniqueness retry
  for (let i = 0; i < 5; i++) {
    const random = crypto.randomBytes(4).toString('base64url').slice(0, 6).toLowerCase()
    const candidate = `va-${random}`
    const { data: existing } = await supabase
      .from('influencers')
      .select('id')
      .eq('affiliate_code', candidate)
      .maybeSingle()

    if (!existing) return candidate
  }

  // Ultra-fallback with full UUID slice
  return `va-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Auto-assign affiliate code when influencer reaches 'onboarded' status.
 * Returns the code if newly assigned, null if already had one.
 */
export async function assignAffiliateCodeOnOnboarded(
  influencerId: string,
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, affiliate_code, platform_handle')
    .eq('id', influencerId)
    .single()

  if (!influencer) return null
  if (influencer.affiliate_code) return null // already has one

  const code = await generateAffiliateCode(influencerId, influencer.platform_handle)

  await supabase
    .from('influencers')
    .update({ affiliate_code: code })
    .eq('id', influencerId)

  return code
}
