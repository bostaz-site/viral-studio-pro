import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logComplianceAction } from '@/lib/admin/compliance/audit-logger'

// POST /api/admin/compliance/gdpr-export — export all data for an email (RGPD)
export const POST = withAdmin(async (req: NextRequest, user) => {
  const { email } = await req.json()
  if (!email) return errorResponse('email is required')

  const admin = createAdminClient()
  const lowerEmail = email.toLowerCase().trim()

  // Collect all data for this email
  const { data: influencer } = await admin
    .from('influencers')
    .select('*')
    .eq('email', lowerEmail)
    .maybeSingle()

  const { data: messages } = influencer
    ? await admin.from('email_messages').select('*').eq('influencer_id', influencer.id).limit(500)
    : { data: null }

  const { data: events } = influencer
    ? await admin.from('email_events').select('*').eq('influencer_id', influencer.id).limit(500)
    : { data: null }

  const { data: clicks } = influencer
    ? await admin.from('affiliate_clicks').select('*').eq('influencer_id', influencer.id).limit(500)
    : { data: null }

  const { data: suppression } = await admin
    .from('suppression_list')
    .select('*')
    .eq('email', lowerEmail)

  // Log the export request
  await logComplianceAction({
    action: 'gdpr_export_requested',
    targetType: 'influencer',
    targetId: influencer?.id,
    details: { email: lowerEmail },
    triggeredBy: user.id,
  })

  return jsonResponse({
    email: lowerEmail,
    exportedAt: new Date().toISOString(),
    influencer: influencer || null,
    messages: messages || [],
    events: events || [],
    clicks: clicks || [],
    suppression: suppression || [],
  })
})
