import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

// GET — email events for a specific influencer (timeline)
export const GET = withAdmin(async (req) => {
  const segments = req.nextUrl.pathname.split('/')
  const idIndex = segments.indexOf('influencers') + 1
  const id = segments[idIndex]
  if (!id) return errorResponse('Missing influencer id', 400)

  const admin = createAdminClientUntyped()
  const { data, error } = await admin
    .from('email_events')
    .select('id, event_type, occurred_at, metadata, campaign_id')
    .eq('influencer_id', id)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ events: data || [] })
})
