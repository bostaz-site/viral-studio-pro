import { validateContact, type ContactValidationResult } from '@/lib/admin/compliance/contact-validator'
import { createAdminClient } from '@/lib/supabase/admin'

export async function compliancePreflight(influencerId: string): Promise<ContactValidationResult> {
  const admin = createAdminClient()
  const { data: inf } = await admin
    .from('influencers')
    .select('email, platform_handle, primary_platform, platform_url, source')
    .eq('id', influencerId)
    .single()

  if (!inf) return { allowed: false, blocks: ['Influencer not found'], warnings: [] }

  return validateContact({
    email: inf.email,
    handle: inf.platform_handle,
    platform: inf.primary_platform,
    profileUrl: inf.platform_url,
    sourceUrl: inf.source,
    intent: 'send_email',
  })
}
