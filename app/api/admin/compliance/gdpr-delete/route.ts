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
    .select('id')
    .eq('email', lowerEmail)
    .maybeSingle()

  const deletedItems: string[] = []

  if (influencer) {
    // Delete email messages
    await admin.from('email_messages').delete().eq('influencer_id', influencer.id)
    deletedItems.push('email_messages')

    // Delete email events
    await admin.from('email_events').delete().eq('influencer_id', influencer.id)
    deletedItems.push('email_events')

    // Delete affiliate clicks
    await admin.from('affiliate_clicks').delete().eq('influencer_id', influencer.id)
    deletedItems.push('affiliate_clicks')

    // Delete partner sessions
    await admin.from('partner_sessions').delete().eq('influencer_id', influencer.id)
    deletedItems.push('partner_sessions')

    // Delete the influencer record
    await admin.from('influencers').delete().eq('id', influencer.id)
    deletedItems.push('influencers')
  }

  // Add to suppression list (prevent re-contact)
  await admin.from('suppression_list').upsert(
    { email: lowerEmail, reason: 'gdpr_request', source: 'gdpr_delete' },
    { onConflict: 'email' }
  )
  deletedItems.push('suppression_added')

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
