import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'
import { z } from 'zod'

const VALID_STATUSES = [
  'unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied',
  'interested', 'demo_sent', 'evaluating', 'onboarded', 'active',
  'paying', 'dormant', 'declined', 'blocked',
] as const

const VALID_PLATFORMS = [
  'twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other',
] as const

const VALID_SORT_FIELDS = [
  'lead_score', 'audience_size', 'created_at', 'last_replied_at',
  'last_sent_at', 'last_contacted_at', 'next_follow_up_at', 'status_changed_at',
] as const

const COLUMNS = [
  'id', 'email', 'first_name', 'last_name', 'display_name',
  'primary_platform', 'platform_handle', 'platform_url',
  'audience_size', 'niche', 'country', 'language',
  'status', 'status_changed_at', 'lead_score', 'lead_score_reasons',
  'tags', 'notes', 'source',
  'has_opened', 'has_clicked', 'has_replied', 'has_bounced', 'has_unsubscribed',
  'last_sent_at', 'last_opened_at', 'last_replied_at', 'last_contacted_at',
  'next_follow_up_at', 'reply_reviewed',
  'total_emails_sent', 'total_emails_opened', 'total_emails_replied',
  'ai_affiliate_score', 'ai_recommendation',
  'affiliate_code', 'unsubscribed',
  'created_at', 'updated_at',
].join(', ')

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  statuses: z.string().optional(),
  platforms: z.string().optional(),
  has_email: z.enum(['true', 'false']).optional(),
  source: z.string().optional(),
  score_min: z.coerce.number().int().min(0).max(100).optional(),
  sort_by: z.enum(VALID_SORT_FIELDS).default('lead_score'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  // Predefined views
  view: z.enum([
    'replied_unreviewed', 'interested_followup', 'top_cold',
    'contacted_stale', 'high_intent_no_email', 'recent_imports',
  ]).optional(),
})

// GET — paginated influencer list with filters + predefined views
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return errorResponse(`Invalid params: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400)
  }

  const { page, per_page, search, statuses, platforms, has_email, source, score_min, sort_by, sort_dir, view } = parsed.data
  const admin = createAdminClientUntyped()
  const offset = (page - 1) * per_page

  let query = admin
    .from('influencers')
    .select(COLUMNS, { count: 'exact' })

  // Apply predefined view filters
  if (view === 'replied_unreviewed') {
    query = query.eq('status', 'replied').eq('reply_reviewed', false)
    // Override sort
    query = query.order('last_replied_at', { ascending: false, nullsFirst: false })
  } else if (view === 'interested_followup') {
    query = query.eq('status', 'interested')
      .or('next_follow_up_at.lte.' + new Date().toISOString() + ',next_follow_up_at.is.null')
    query = query.order('next_follow_up_at', { ascending: true, nullsFirst: true })
  } else if (view === 'top_cold') {
    query = query.eq('status', 'cold')
      .gte('lead_score', 70)
      .not('email', 'is', null)
    query = query.order('lead_score', { ascending: false })
  } else if (view === 'contacted_stale') {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    query = query.eq('status', 'contacted')
      .lt('last_sent_at', fiveDaysAgo)
      .eq('has_replied', false)
    query = query.order('last_sent_at', { ascending: true })
  } else if (view === 'high_intent_no_email') {
    query = query.is('email', null).gte('lead_score', 70)
    query = query.order('lead_score', { ascending: false })
  } else if (view === 'recent_imports') {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', oneDayAgo)
    query = query.order('created_at', { ascending: false })
  } else {
    // Manual filters (only when no predefined view)
    if (statuses) {
      const list = statuses.split(',').filter(s => (VALID_STATUSES as readonly string[]).includes(s))
      if (list.length > 0) query = query.in('status', list)
    }
    if (platforms) {
      const list = platforms.split(',').filter(p => (VALID_PLATFORMS as readonly string[]).includes(p))
      if (list.length > 0) query = query.in('primary_platform', list)
    }
    if (has_email === 'true') query = query.not('email', 'is', null)
    if (has_email === 'false') query = query.is('email', null)
    if (source) query = query.eq('source', source)
    if (score_min !== undefined) query = query.gte('lead_score', score_min)

    query = query.order(sort_by, { ascending: sort_dir === 'asc', nullsFirst: false })
  }

  // Search applies to all views
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,display_name.ilike.%${search}%,platform_handle.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    )
  }

  query = query.range(offset, offset + per_page - 1)

  const { data, count, error } = await query
  if (error) return errorResponse(error.message, 500)

  return jsonResponse({
    influencers: data || [],
    total: count || 0,
    page,
    per_page,
    total_pages: Math.ceil((count || 0) / per_page),
  })
})

// PATCH — bulk update influencers (status, tags, reply_reviewed, block)
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const { ids, action, value } = body as {
    ids: string[]
    action: 'set_status' | 'add_tag' | 'mark_reviewed' | 'block'
    value?: string
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse('ids required', 400)
  }
  if (ids.length > 200) {
    return errorResponse('Max 200 ids per bulk action', 400)
  }

  const admin = createAdminClientUntyped()

  if (action === 'set_status') {
    if (!value || !(VALID_STATUSES as readonly string[]).includes(value)) {
      return errorResponse('Invalid status', 400)
    }
    const { error } = await admin
      .from('influencers')
      .update({ status: value })
      .in('id', ids)
    if (error) return errorResponse(error.message, 500)
  } else if (action === 'add_tag') {
    if (!value || value.trim().length === 0) return errorResponse('Tag value required', 400)
    const tag = value.trim().toLowerCase()
    // Fetch current tags, add the new one
    const { data: rows, error: fetchErr } = await admin
      .from('influencers')
      .select('id, tags')
      .in('id', ids)
    if (fetchErr) return errorResponse(fetchErr.message, 500)
    for (const row of rows || []) {
      const existing: string[] = row.tags || []
      if (!existing.includes(tag)) {
        await admin
          .from('influencers')
          .update({ tags: [...existing, tag] })
          .eq('id', row.id)
      }
    }
  } else if (action === 'mark_reviewed') {
    const { error } = await admin
      .from('influencers')
      .update({ reply_reviewed: true })
      .in('id', ids)
    if (error) return errorResponse(error.message, 500)
  } else if (action === 'block') {
    // Set status to blocked + add to suppression_list
    const { data: rows, error: fetchErr } = await admin
      .from('influencers')
      .select('id, email')
      .in('id', ids)
    if (fetchErr) return errorResponse(fetchErr.message, 500)
    const { error: updateErr } = await admin
      .from('influencers')
      .update({ status: 'blocked' })
      .in('id', ids)
    if (updateErr) return errorResponse(updateErr.message, 500)
    // Add emails to suppression_list
    const suppressionRows = (rows || [])
      .filter(r => r.email)
      .map(r => ({
        email: r.email.toLowerCase(),
        reason: 'blocked_from_crm',
        added_by: 'admin',
        created_at: new Date().toISOString(),
      }))
    if (suppressionRows.length > 0) {
      await admin
        .from('suppression_list')
        .upsert(suppressionRows, { onConflict: 'email', ignoreDuplicates: true })
    }
  } else {
    return errorResponse('Unknown action', 400)
  }

  return jsonResponse({ updated: ids.length })
})
