import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/compliance/audit — query compliance audit log
export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 50

  const admin = createAdminClient()

  let query = admin
    .from('compliance_audit_log')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })

  if (action) query = query.eq('action', action)

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data, error, count } = await query

  if (error) return errorResponse('Failed to load audit log', 500)

  // Stats
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count: blocksToday } = await admin
    .from('compliance_audit_log')
    .select('id', { count: 'exact', head: true })
    .in('action', ['contact_blocked_no_source', 'contact_blocked_suppressed', 'contact_blocked_no_email', 'caption_blocked_no_disclosure'])
    .gte('occurred_at', oneDayAgo)

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: blocksThisWeek } = await admin
    .from('compliance_audit_log')
    .select('id', { count: 'exact', head: true })
    .in('action', ['contact_blocked_no_source', 'contact_blocked_suppressed', 'contact_blocked_no_email', 'caption_blocked_no_disclosure'])
    .gte('occurred_at', oneWeekAgo)

  const { count: gdprPending } = await admin
    .from('compliance_audit_log')
    .select('id', { count: 'exact', head: true })
    .in('action', ['gdpr_export_requested', 'gdpr_delete_requested'])
    .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  return jsonResponse({
    entries: data || [],
    total: count || 0,
    page,
    hasMore: (data?.length || 0) === limit,
    stats: {
      blocksToday: blocksToday || 0,
      blocksThisWeek: blocksThisWeek || 0,
      gdprPending: gdprPending || 0,
    },
  })
})
