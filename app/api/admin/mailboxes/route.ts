import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list all mailboxes with health data
export const GET = withAdmin(async (req) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const domain = url.searchParams.get('domain')

  let query = supabase
    .from('mailboxes')
    .select('id, email, domain, display_name, provider, status, reputation_score, bounce_rate_pct, complaint_rate_pct, daily_send_limit, emails_sent_today, total_emails_sent, spf_valid, dkim_valid, dmarc_valid, last_health_check_at, instantly_account_id, created_at, updated_at')
    .is('retired_at', null)
    .order('reputation_score', { ascending: true, nullsFirst: false })

  if (status) query = query.eq('status', status)
  if (domain) query = query.eq('domain', domain)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)

  // Compute 7-day stats per mailbox
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: weekStats } = await supabase
    .from('mailbox_daily_stats')
    .select('mailbox_id, emails_sent, emails_bounced, emails_replied')
    .gte('stat_date', sevenDaysAgo)

  const statsMap = new Map<string, { sent: number; bounced: number; replied: number }>()
  for (const s of weekStats ?? []) {
    const existing = statsMap.get(s.mailbox_id) ?? { sent: 0, bounced: 0, replied: 0 }
    existing.sent += s.emails_sent ?? 0
    existing.bounced += s.emails_bounced ?? 0
    existing.replied += s.emails_replied ?? 0
    statsMap.set(s.mailbox_id, existing)
  }

  const enriched = (data ?? []).map(mb => {
    const week = statsMap.get(mb.id)
    return {
      ...mb,
      week_sent: week?.sent ?? 0,
      week_bounced: week?.bounced ?? 0,
      week_replied: week?.replied ?? 0,
      week_bounce_rate: week && week.sent > 0 ? ((week.bounced / week.sent) * 100) : 0,
      week_reply_rate: week && week.sent > 0 ? ((week.replied / week.sent) * 100) : 0,
    }
  })

  return jsonResponse(enriched)
})
