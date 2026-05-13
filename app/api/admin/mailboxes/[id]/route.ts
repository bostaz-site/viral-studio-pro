import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 1]
}

// GET — mailbox detail with daily stats + alerts
export const GET = withAdmin(async (req) => {
  const id = extractId(req)
  const supabase = createAdminClient()

  const [mailboxRes, statsRes, alertsRes, domainRes] = await Promise.all([
    supabase.from('mailboxes')
      .select('*')
      .eq('id', id)
      .single(),
    supabase.from('mailbox_daily_stats')
      .select('*')
      .eq('mailbox_id', id)
      .order('stat_date', { ascending: false })
      .limit(30),
    supabase.from('agent_alerts')
      .select('id, severity, title, description, detected_at, dismissed_at')
      .eq('category', 'mailbox')
      .is('dismissed_at', null)
      .order('detected_at', { ascending: false })
      .limit(20),
    null, // will resolve domain separately
  ])

  if (mailboxRes.error) return errorResponse('Mailbox not found', 404)

  const mb = mailboxRes.data

  // Get domain info
  const { data: domainInfo } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', mb.domain)
    .maybeSingle()

  // Filter alerts for this mailbox (check metadata)
  const relevantAlerts = (alertsRes.data ?? []).filter(a => {
    const desc = a.description ?? ''
    return desc.includes(mb.email) || desc.includes(mb.id)
  })

  return jsonResponse({
    mailbox: mb,
    daily_stats: statsRes.data ?? [],
    alerts: relevantAlerts,
    domain: domainInfo,
  })
})
