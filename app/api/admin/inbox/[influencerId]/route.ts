import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/inbox/[influencerId] — get all messages for a thread
export const GET = withAdmin(
  async (
    req: NextRequest,
    _user,
  ) => {
    const url = new URL(req.url)
    const segments = url.pathname.split('/')
    const influencerId = segments[segments.length - 1]

    if (!influencerId) return errorResponse('influencerId required')

    const admin = createAdminClient()

    // Get influencer details
    const { data: influencer, error: infError } = await admin
      .from('influencers')
      .select('*')
      .eq('id', influencerId)
      .single()

    if (infError || !influencer) {
      return errorResponse('Influencer not found', 404)
    }

    // Get all messages for this influencer, ordered chronologically
    const { data: messages, error: msgError } = await admin
      .from('email_messages')
      .select('*')
      .eq('influencer_id', influencerId)
      .order('created_at', { ascending: true })

    if (msgError) {
      return errorResponse('Failed to load messages', 500)
    }

    // Get email events for this influencer
    const { data: events } = await admin
      .from('email_events')
      .select('*')
      .eq('influencer_id', influencerId)
      .order('occurred_at', { ascending: true })

    // Auto-mark inbound messages as read
    const unreadIds = (messages || [])
      .filter(m => m.direction === 'inbound' && !m.is_read)
      .map(m => m.id)

    if (unreadIds.length > 0) {
      await admin
        .from('email_messages')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .in('id', unreadIds)
    }

    return jsonResponse({
      influencer,
      messages: messages || [],
      events: events || [],
    })
  }
)
