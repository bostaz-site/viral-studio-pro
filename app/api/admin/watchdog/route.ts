import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/watchdog — list alerts + health overview
export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const tab = url.searchParams.get('tab') || 'active' // active | dismissed
  const severity = url.searchParams.get('severity') || '' // critical | important | info
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 50

  const admin = createAdminClient()

  let query = admin
    .from('agent_alerts')
    .select('*', { count: 'exact' })
    .order('detected_at', { ascending: false })

  if (tab === 'active') {
    query = query.is('dismissed_at', null).is('resolved_at', null)
  } else if (tab === 'dismissed') {
    query = query.not('dismissed_at', 'is', null)
  }

  if (severity) query = query.eq('severity', severity)

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data: alerts, error, count } = await query

  if (error) return errorResponse('Failed to load alerts', 500)

  // Count by severity (active only)
  const { count: criticalCount } = await admin
    .from('agent_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('severity', 'critical')
    .is('dismissed_at', null)
    .is('resolved_at', null)

  const { count: importantCount } = await admin
    .from('agent_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('severity', 'important')
    .is('dismissed_at', null)
    .is('resolved_at', null)

  const { count: infoCount } = await admin
    .from('agent_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('severity', 'info')
    .is('dismissed_at', null)
    .is('resolved_at', null)

  // Health overview: check last webhook, bounce rate
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count: recentWebhooks } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', thirtyMinAgo)

  return jsonResponse({
    alerts: alerts || [],
    total: count || 0,
    page,
    hasMore: (alerts?.length || 0) === limit,
    counts: {
      critical: criticalCount || 0,
      important: importantCount || 0,
      info: infoCount || 0,
    },
    health: {
      webhooks: (recentWebhooks || 0) > 0 ? 'healthy' : 'unknown',
    },
  })
})
