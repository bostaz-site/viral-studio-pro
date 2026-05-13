import { createAdminClient } from '@/lib/supabase/admin'

export interface DashboardOverview {
  greeting: { name: string; date: string }
  whileYouSlept: {
    emailsSent: number
    replies: number
    signups: number
    payingUsers: number
    newAlerts: number
    period: string
  }
  hotLeads: Array<{
    id: string
    email: string
    display_name: string | null
    platform_handle: string | null
    status: string
    lead_score: number
    last_reply_at: string | null
    tags: string[]
  }>
  stuckFollowups: Array<{
    id: string
    email: string
    display_name: string | null
    status: string
    status_changed_at: string | null
    last_active_at: string | null
  }>
  payoutsDue: {
    totalCents: number
    affiliateCount: number
    top: Array<{ display_name: string | null; email: string; due_cents: number }>
  }
  alerts: Array<{
    id: string
    severity: string
    title: string
    description: string | null
    detected_at: string
  }>
  weeklyGoal: { target: number; current: number; label: string }
  mrr: { current: number; prevWeek: number; changePct: number }
}

export async function aggregateDashboard(): Promise<DashboardOverview> {
  const supabase = createAdminClient()
  const now = new Date()
  const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    emailsSentRes,
    repliesRes,
    signupsRes,
    payingRes,
    alertsCountRes,
    hotLeadsRes,
    stuckRes,
    payoutsRes,
    activeAlertsRes,
    mrrCurrentRes,
    mrrPrevRes,
    weekSignupsRes,
  ] = await Promise.all([
    // While you slept: emails sent
    supabase.from('email_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'sent')
      .gte('occurred_at', sixteenHoursAgo),

    // While you slept: replies
    supabase.from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .gte('created_at', sixteenHoursAgo),

    // While you slept: signups (product_activation_events)
    supabase.from('product_activation_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'user_signed_up')
      .gte('occurred_at', sixteenHoursAgo),

    // While you slept: new paying users
    supabase.from('product_activation_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'trial_converted_paid')
      .gte('occurred_at', sixteenHoursAgo),

    // While you slept: new alerts
    supabase.from('agent_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('detected_at', sixteenHoursAgo)
      .is('dismissed_at', null),

    // Hot leads: high score + recent reply
    supabase.from('influencers')
      .select('id, email, display_name, platform_handle, status, lead_score, last_active_at, tags')
      .in('status', ['replied', 'interested', 'demo_sent', 'evaluating'])
      .gte('last_active_at', twentyFourHoursAgo)
      .order('lead_score', { ascending: false })
      .limit(10),

    // Stuck: onboarded/demo_sent/evaluating + no activity > 5 days
    supabase.from('influencers')
      .select('id, email, display_name, status, status_changed_at, last_active_at')
      .in('status', ['onboarded', 'demo_sent', 'evaluating'])
      .lt('last_active_at', fiveDaysAgo)
      .order('last_active_at', { ascending: true })
      .limit(10),

    // Payouts due: earned - paid > 0
    supabase.from('influencers')
      .select('id, email, display_name, total_commission_earned_cents, total_commission_paid_cents')
      .not('affiliate_code', 'is', null)
      .gt('total_commission_earned_cents', 0)
      .order('total_commission_earned_cents', { ascending: false })
      .limit(20),

    // Active watchdog alerts
    supabase.from('agent_alerts')
      .select('id, severity, title, description, detected_at')
      .is('dismissed_at', null)
      .order('detected_at', { ascending: false })
      .limit(10),

    // MRR: paying users this week
    supabase.from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('plan', ['pro', 'studio']),

    // MRR: paying users prev week (approximation)
    supabase.from('product_activation_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'trial_converted_paid')
      .gte('occurred_at', fourteenDaysAgo)
      .lt('occurred_at', sevenDaysAgo),

    // Weekly goal: signups this week
    supabase.from('product_activation_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'user_signed_up')
      .gte('occurred_at', sevenDaysAgo),
  ])

  // Calculate payouts
  const payoutsList = (payoutsRes.data ?? [])
    .map(p => ({
      display_name: p.display_name,
      email: p.email,
      due_cents: (p.total_commission_earned_cents ?? 0) - (p.total_commission_paid_cents ?? 0),
    }))
    .filter(p => p.due_cents > 0)

  // MRR calculation (rough: paying users * avg $21.50/mo)
  const payingCount = mrrCurrentRes.count ?? 0
  const avgRevenue = 2150 // $21.50 avg between $19 pro and $24 studio, in cents
  const currentMrr = payingCount * avgRevenue
  const prevPayingCount = Math.max(0, payingCount - (mrrPrevRes.count ?? 0))
  const prevMrr = prevPayingCount * avgRevenue
  const changePct = prevMrr > 0 ? Math.round(((currentMrr - prevMrr) / prevMrr) * 100) : 0

  return {
    greeting: {
      name: 'Samy',
      date: now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    },
    whileYouSlept: {
      emailsSent: emailsSentRes.count ?? 0,
      replies: repliesRes.count ?? 0,
      signups: signupsRes.count ?? 0,
      payingUsers: payingRes.count ?? 0,
      newAlerts: alertsCountRes.count ?? 0,
      period: '16h',
    },
    hotLeads: (hotLeadsRes.data ?? []).map(l => ({
      id: l.id,
      email: l.email,
      display_name: l.display_name,
      platform_handle: l.platform_handle,
      status: l.status,
      lead_score: l.lead_score ?? 0,
      last_reply_at: l.last_active_at,
      tags: l.tags ?? [],
    })),
    stuckFollowups: (stuckRes.data ?? []).map(s => ({
      id: s.id,
      email: s.email,
      display_name: s.display_name,
      status: s.status,
      status_changed_at: s.status_changed_at,
      last_active_at: s.last_active_at,
    })),
    payoutsDue: {
      totalCents: payoutsList.reduce((s, p) => s + p.due_cents, 0),
      affiliateCount: payoutsList.length,
      top: payoutsList.slice(0, 5),
    },
    alerts: (activeAlertsRes.data ?? []).map(a => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      description: a.description,
      detected_at: a.detected_at,
    })),
    weeklyGoal: {
      target: 50,
      current: weekSignupsRes.count ?? 0,
      label: 'Signups this week',
    },
    mrr: {
      current: currentMrr,
      prevWeek: prevMrr,
      changePct,
    },
  }
}
