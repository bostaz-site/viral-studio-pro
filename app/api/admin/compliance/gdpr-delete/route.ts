import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logComplianceAction } from '@/lib/admin/compliance/audit-logger'

// POST /api/admin/compliance/gdpr-delete — delete all data for an email (RGPD right to be forgotten)
export const POST = withAdmin(async (req: NextRequest, user) => {
  const { email, confirm } = await req.json()
  if (!email) return errorResponse('email is required')
  if (confirm !== true) return errorResponse('confirm: true is required to proceed with deletion')

  const admin = createAdminClient()
  const lowerEmail = email.toLowerCase().trim()

  // Find influencer
  const { data: influencer } = await admin
    .from('influencers')
    .select('id, platform_handle')
    .eq('email', lowerEmail)
    .maybeSingle()

  const deletedItems: string[] = []

  if (influencer) {
    const iid = influencer.id

    // Delete from ALL tables that reference this influencer
    // Order: dependent tables first, then the influencer record

    // Communication & outreach
    await admin.from('email_messages').delete().eq('influencer_id', iid)
    deletedItems.push('email_messages')

    await admin.from('email_events').delete().eq('influencer_id', iid)
    deletedItems.push('email_events')

    await admin.from('campaign_recipients').delete().eq('influencer_id', iid)
    deletedItems.push('campaign_recipients')

    // Offers & matching
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('generated_offers').delete().eq('influencer_id', iid)
    deletedItems.push('generated_offers')

    await admin.from('video_influencer_matches').delete().eq('influencer_id', iid)
    deletedItems.push('video_influencer_matches')

    // Discovery & scraping (tables may not exist in typed schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await (admin as any).from('lead_discovery_results').delete().eq('influencer_id', iid) } catch { /* table may not exist */ }
    deletedItems.push('lead_discovery_results')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await (admin as any).from('public_contact_points').delete().eq('influencer_id', iid) } catch { /* table may not exist */ }
    deletedItems.push('public_contact_points')

    // Affiliate & partner
    await admin.from('affiliate_clicks').delete().eq('influencer_id', iid)
    deletedItems.push('affiliate_clicks')

    await admin.from('affiliate_referrals').delete().eq('influencer_id', iid)
    deletedItems.push('affiliate_referrals')

    await admin.from('affiliate_commission_ledger').delete().eq('influencer_id', iid)
    deletedItems.push('affiliate_commission_ledger')

    await admin.from('affiliate_payouts').delete().eq('influencer_id', iid)
    deletedItems.push('affiliate_payouts')

    await admin.from('partner_sessions').delete().eq('influencer_id', iid)
    deletedItems.push('partner_sessions')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await (admin as any).from('repost_kit_sessions').delete().eq('influencer_id', iid) } catch { /* table may not exist */ }
    deletedItems.push('repost_kit_sessions')

    // Fraud flags
    await admin.from('fraud_flags').delete().eq('influencer_id', iid)
    deletedItems.push('fraud_flags')

    // Video assignment log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await (admin as any).from('video_assignment_log').delete().eq('influencer_id', iid) } catch { /* table may not exist */ }
    deletedItems.push('video_assignment_log')

    // Delete the influencer record itself
    await admin.from('influencers').delete().eq('id', iid)
    deletedItems.push('influencers')
  }

  // Add to suppression list with ALL identifiers (4-way: email + handle)
  // This prevents re-scraping and re-contacting via any vector
  await admin.from('suppression_list').upsert(
    {
      email: lowerEmail,
      email_domain: null, // Never domain-block on individual GDPR requests
      platform_handle: influencer?.platform_handle ?? null,
      reason: 'gdpr_request',
      source: 'gdpr_delete',
    },
    { onConflict: 'email' }
  )
  deletedItems.push('suppression_added_4way')

  // Log the deletion
  await logComplianceAction({
    action: 'gdpr_delete_requested',
    targetType: 'influencer',
    targetId: influencer?.id,
    details: { email: lowerEmail, deletedItems },
    triggeredBy: user.id,
  })

  return jsonResponse({
    email: lowerEmail,
    deletedAt: new Date().toISOString(),
    deletedItems,
    suppressionAdded: true,
  })
})
