import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const url = req.nextUrl

  const status = url.searchParams.get('status')
  const agent = url.searchParams.get('agent')
  const severity = url.searchParams.get('severity')
  const tab = url.searchParams.get('tab') || 'today'

  let query = admin
    .from('audit_findings')
    .select('*')
    .order('audit_date', { ascending: false })

  if (tab === 'today') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    query = query.gte('audit_date', todayStart.toISOString())
  } else if (tab === 'open') {
    query = query.eq('status', 'open')
  }
  // 'history' tab = no additional filter (show all)

  if (status) query = query.eq('status', status)
  if (agent) query = query.eq('agent_type', agent)
  if (severity) query = query.eq('severity', severity)

  query = query.limit(200)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
