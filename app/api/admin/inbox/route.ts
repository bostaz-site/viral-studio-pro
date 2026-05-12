import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/inbox — list threads (grouped by influencer)
export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') || 'all' // all | unread | starred | archived
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 50

  const admin = createAdminClient()

  // Build query for threads: latest message per influencer
  // We use a subquery approach: get distinct influencer_ids with their latest message
  let query = admin
    .from('email_messages')
    .select(`
      id,
      influencer_id,
      direction,
      subject,
      body_text,
      sent_at,
      is_read,
      is_archived,
      is_starred,
      created_at,
      thread_id,
      influencers!inner (
        id,
        email,
        display_name,
        first_name,
        last_name,
        status,
        lead_score,
        tags,
        primary_platform,
        platform_handle
      )
    `)
    .order('created_at', { ascending: false })

  // Filters
  if (filter === 'unread') {
    query = query.eq('is_read', false).eq('is_archived', false)
  } else if (filter === 'starred') {
    query = query.eq('is_starred', true)
  } else if (filter === 'archived') {
    query = query.eq('is_archived', true)
  } else {
    // 'all' — exclude archived
    query = query.eq('is_archived', false)
  }

  // Search by influencer email or name
  if (search) {
    query = query.or(
      `influencers.email.ilike.%${search}%,influencers.display_name.ilike.%${search}%,subject.ilike.%${search}%`
    )
  }

  // Paginate
  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data: messages, error } = await query

  if (error) {
    console.error('[inbox] Query error:', error)
    return errorResponse('Failed to load inbox', 500)
  }

  // Group into threads by influencer_id, keeping latest message per influencer
  const threadMap = new Map<string, {
    influencer: Record<string, unknown>
    lastMessage: Record<string, unknown>
    unreadCount: number
    messageCount: number
  }>()

  for (const msg of messages || []) {
    const infId = msg.influencer_id
    if (!infId) continue
    const existing = threadMap.get(infId)
    if (!existing) {
      threadMap.set(infId, {
        influencer: msg.influencers as Record<string, unknown>,
        lastMessage: {
          id: msg.id,
          direction: msg.direction,
          subject: msg.subject,
          // Truncate body for thread list preview (60 chars)
          preview: msg.body_text ? msg.body_text.substring(0, 60) + (msg.body_text.length > 60 ? '...' : '') : '',
          sent_at: msg.sent_at,
          created_at: msg.created_at,
          is_read: msg.is_read,
          is_starred: msg.is_starred,
          is_archived: msg.is_archived,
        },
        unreadCount: msg.is_read ? 0 : 1,
        messageCount: 1,
      })
    } else {
      existing.messageCount++
      if (!msg.is_read) existing.unreadCount++
    }
  }

  const threads = Array.from(threadMap.values())

  // Get total unread count
  const { count: totalUnread } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('is_archived', false)
    .eq('direction', 'inbound')

  return jsonResponse({
    threads,
    totalUnread: totalUnread || 0,
    page,
    hasMore: (messages?.length || 0) === limit,
  })
})

// PATCH /api/admin/inbox — bulk actions (mark read, archive, etc.)
export const PATCH = withAdmin(async (req: NextRequest) => {
  const body = await req.json()
  const { messageIds, action } = body as {
    messageIds: string[]
    action: 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'mark_hot'
  }

  if (!messageIds?.length || !action) {
    return errorResponse('messageIds and action required')
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const updateMap: Record<string, Record<string, unknown>> = {
    mark_read: { is_read: true, updated_at: now },
    mark_unread: { is_read: false, updated_at: now },
    star: { is_starred: true, updated_at: now },
    unstar: { is_starred: false, updated_at: now },
    archive: { is_archived: true, is_read: true, updated_at: now },
    unarchive: { is_archived: false, updated_at: now },
    mark_hot: { is_starred: true, updated_at: now },
  }

  const update = updateMap[action]
  if (!update) return errorResponse('Invalid action')

  const { error } = await admin
    .from('email_messages')
    .update(update)
    .in('id', messageIds)

  if (error) return errorResponse('Update failed', 500)

  // If marking hot, also tag the influencer
  if (action === 'mark_hot') {
    const { data: msgs } = await admin
      .from('email_messages')
      .select('influencer_id')
      .in('id', messageIds)

    const influencerIds = [...new Set(
      (msgs || []).map(m => m.influencer_id).filter((id): id is string => id != null)
    )]
    for (const infId of influencerIds) {
      const { data: inf } = await admin
        .from('influencers')
        .select('tags')
        .eq('id', infId)
        .single()
      if (inf && !inf.tags?.includes('hot')) {
        await admin
          .from('influencers')
          .update({ tags: [...(inf.tags || []), 'hot'], updated_at: now })
          .eq('id', infId)
      }
    }
  }

  return jsonResponse({ ok: true })
})
