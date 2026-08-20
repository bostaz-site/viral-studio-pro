import type { SupabaseClient } from '@supabase/supabase-js'
import { checkMailboxHealth } from '@/lib/admin/mailbox/health-checker'

export interface AlertCandidate {
  severity: 'critical' | 'important' | 'info'
  category: string
  title: string
  description: string
  metadata?: Record<string, unknown>
}

// ═══════════════════════════════════════
//  CRITICAL CHECKS (email immediately)
// ═══════════════════════════════════════

/**
 * 1. Instantly webhook down > 30 min during business hours (8am-10pm ET)
 */
export async function checkWebhookDown(admin: SupabaseClient): Promise<AlertCandidate | null> {
  // Only alert during business hours (8-22 ET = 12-02 UTC)
  const hour = new Date().getUTCHours()
  const isBusinessHours = hour >= 12 || hour < 2
  if (!isBusinessHours) return null

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { count } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'instantly')
    .gte('received_at', thirtyMinAgo)

  // If we have at least 1 webhook in 30 min, all good
  if (count && count > 0) return null

  // Guard: only alert if Instantly was active recently (at least 1 event in 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'instantly')
    .gte('received_at', sevenDaysAgo)

  if (!recentCount || recentCount === 0) return null

  return {
    severity: 'critical',
    category: 'webhook',
    title: 'Instantly webhooks down > 30 min',
    description: 'No webhook events received from Instantly in the last 30 minutes during business hours. Check Instantly webhook config and endpoint health.',
    metadata: { last_check: new Date().toISOString(), provider: 'instantly' },
  }
}

/**
 * 2. Stripe webhook failures in last 60 min
 */
export async function checkStripeWebhookFail(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'stripe')
    .eq('processing_status', 'failed')
    .gte('received_at', oneHourAgo)

  if (!count || count === 0) return null

  return {
    severity: 'critical',
    category: 'stripe',
    title: `${count} Stripe webhook(s) failed in last hour`,
    description: `${count} Stripe webhook event(s) failed processing in the last 60 minutes. Check /admin/webhooks for details and retry.`,
    metadata: { failed_count: count, window: '60min' },
  }
}

/**
 * 3. Mailbox bounce rate > 5% in 24h
 */
export async function checkBounceRate(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count: sentCount } = await admin
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'sent')
    .gte('occurred_at', oneDayAgo)

  const { count: bounceCount } = await admin
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', ['bounced_hard', 'bounced_soft'])
    .gte('occurred_at', oneDayAgo)

  if (!sentCount || sentCount < 10) return null // Too few to judge
  const rate = ((bounceCount || 0) / sentCount) * 100

  if (rate <= 5) return null

  return {
    severity: 'critical',
    category: 'mailbox',
    title: `Bounce rate ${rate.toFixed(1)}% exceeds 5% threshold`,
    description: `${bounceCount} bounces out of ${sentCount} emails sent in the last 24h. Check domain reputation and suppression list.`,
    metadata: { bounce_rate: rate, sent: sentCount, bounced: bounceCount },
  }
}

/**
 * 4. Stripe Connect account rejected
 */
export async function checkStripeConnectRejected(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const { data: rejected } = await admin
    .from('influencers')
    .select('id, email, display_name')
    .eq('stripe_connect_status', 'rejected')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (!rejected || rejected.length === 0) return null

  // Check if we already alerted for these (avoid re-alerting)
  const emails = rejected.map(r => r.email).join(', ')

  return {
    severity: 'critical',
    category: 'affiliate',
    title: `${rejected.length} Stripe Connect account(s) rejected`,
    description: `Affiliates with rejected KYC: ${emails}. They cannot receive payouts until resolved.`,
    metadata: { rejected_ids: rejected.map(r => r.id) },
  }
}

/**
 * 5. Webhook processing failures spike (>10 failures in 1h for any provider)
 */
export async function checkWebhookFailSpike(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'failed')
    .gte('received_at', oneHourAgo)

  if (!count || count < 10) return null

  return {
    severity: 'critical',
    category: 'webhook',
    title: `${count} webhook failures in last hour`,
    description: `${count} webhook events failed processing across all providers in the last hour. Check /admin/webhooks.`,
    metadata: { failed_count: count },
  }
}

// ═══════════════════════════════════════
//  IMPORTANT CHECKS (daily digest)
// ═══════════════════════════════════════

/**
 * 1. Hot leads not responded > 4h
 */
export async function checkHotLeadsStale(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  const { data: stale } = await admin
    .from('influencers')
    .select('id, email, display_name, status, last_active_at')
    .in('status', ['replied', 'interested'])
    .lt('last_active_at', fourHoursAgo)
    .order('last_active_at', { ascending: true })
    .limit(20)

  if (!stale || stale.length === 0) return null

  return {
    severity: 'important',
    category: 'crm',
    title: `${stale.length} hot lead(s) waiting > 4h for response`,
    description: `Leads in replied/interested status haven't been engaged in over 4 hours. Check inbox.`,
    metadata: { leads: stale.map(l => ({ id: l.id, email: l.email, status: l.status })) },
  }
}

/**
 * 2. Onboarded affiliate without activity in 5 days
 */
export async function checkDormantAffiliates(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const { data: dormant } = await admin
    .from('influencers')
    .select('id, email, display_name')
    .eq('status', 'onboarded')
    .lt('updated_at', fiveDaysAgo)
    .limit(20)

  if (!dormant || dormant.length === 0) return null

  return {
    severity: 'important',
    category: 'affiliate',
    title: `${dormant.length} onboarded affiliate(s) inactive > 5 days`,
    description: 'These affiliates were onboarded but have shown no activity. Consider sending a follow-up or engagement email.',
    metadata: { affiliates: dormant.map(a => ({ id: a.id, email: a.email })) },
  }
}

/**
 * 3. Reply rate dropped > 50% week-over-week
 */
export async function checkReplyRateDrop(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const now = Date.now()
  const thisWeekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const lastWeekStart = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  // This week sent
  const { count: sentThisWeek } = await admin
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'sent')
    .gte('occurred_at', thisWeekStart)

  // This week replies
  const { count: repliedThisWeek } = await admin
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'replied')
    .gte('occurred_at', thisWeekStart)

  // Last week sent
  const { count: sentLastWeek } = await admin
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'sent')
    .gte('occurred_at', lastWeekStart)
    .lt('occurred_at', thisWeekStart)

  // Last week replies
  const { count: repliedLastWeek } = await admin
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'replied')
    .gte('occurred_at', lastWeekStart)
    .lt('occurred_at', thisWeekStart)

  if (!sentLastWeek || sentLastWeek < 20 || !sentThisWeek || sentThisWeek < 20) return null

  const rateThisWeek = ((repliedThisWeek || 0) / sentThisWeek) * 100
  const rateLastWeek = ((repliedLastWeek || 0) / sentLastWeek) * 100

  if (rateLastWeek === 0) return null
  const dropPercent = ((rateLastWeek - rateThisWeek) / rateLastWeek) * 100

  if (dropPercent <= 50) return null

  return {
    severity: 'important',
    category: 'mailbox',
    title: `Reply rate dropped ${dropPercent.toFixed(0)}% week-over-week`,
    description: `Reply rate this week: ${rateThisWeek.toFixed(1)}% vs last week: ${rateLastWeek.toFixed(1)}%. Review email templates and deliverability.`,
    metadata: { this_week: rateThisWeek, last_week: rateLastWeek, drop: dropPercent },
  }
}

/**
 * 4. KYC pending > 7 days
 */
export async function checkKycPending(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: pending } = await admin
    .from('influencers')
    .select('id, email, display_name')
    .eq('stripe_connect_status', 'pending_kyc')
    .lt('updated_at', sevenDaysAgo)
    .limit(20)

  if (!pending || pending.length === 0) return null

  return {
    severity: 'important',
    category: 'affiliate',
    title: `${pending.length} affiliate(s) with KYC pending > 7 days`,
    description: 'These affiliates started Stripe Connect onboarding but haven\'t completed KYC in over 7 days. Consider sending a reminder.',
    metadata: { affiliates: pending.map(p => ({ id: p.id, email: p.email })) },
  }
}

/**
 * 5. Suppression list growing fast (>20 new in 24h)
 */
export async function checkSuppressionSpike(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count } = await admin
    .from('suppression_list')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo)

  if (!count || count < 20) return null

  return {
    severity: 'important',
    category: 'compliance',
    title: `${count} new suppressions in 24h`,
    description: `${count} emails added to suppression list in the last 24 hours (bounces + unsubs). Check email list quality.`,
    metadata: { count },
  }
}

/**
 * Trending clips freshness — alerts if no new clips imported in 6+ hours.
 * This is THE symptom of a fetch rotation deadlock (all slots stuck on failing streamers).
 */
export async function checkTrendingClipsFreshness(admin: SupabaseClient): Promise<AlertCandidate | null> {
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString()

  const { count } = await admin
    .from('trending_clips')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo)

  if (count && count > 0) return null

  return {
    severity: 'critical',
    category: 'fetch-pipeline',
    title: 'Trending clips stale — no imports in 6+ hours',
    description: 'The fetch-streamer-clips cron may be deadlocked (all rotation slots stuck on failing streamers). Check streamer last_fetched_at distribution and cron logs.',
    metadata: { lastImportBefore: sixHoursAgo },
  }
}

/**
 * yt-dlp extractor health — calls VPS GET /api/health/ytdlp to verify
 * the pinned yt-dlp version can still extract Twitch clips.
 * If broken: alert so we bump YT_DLP_VERSION in vps/Dockerfile.
 */
export async function checkYtdlpExtractor(): Promise<AlertCandidate | null> {
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY
  if (!vpsUrl || !vpsKey) return null

  try {
    const res = await fetch(`${vpsUrl}/api/health/ytdlp`, {
      headers: { 'x-api-key': vpsKey },
      signal: AbortSignal.timeout(35_000),
    })
    if (res.ok) return null
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    return {
      severity: 'critical',
      category: 'vps',
      title: 'yt-dlp extractor broken — Twitch downloads failing',
      description: `VPS /api/health/ytdlp returned ${res.status}: ${(body as Record<string, string>).error ?? 'unknown'}. Bump YT_DLP_VERSION in vps/Dockerfile and redeploy.`,
      metadata: { status: res.status, error: (body as Record<string, string>).error },
    }
  } catch (err) {
    return {
      severity: 'critical',
      category: 'vps',
      title: 'yt-dlp health check unreachable',
      description: `Could not reach VPS health endpoint: ${err instanceof Error ? err.message : 'unknown'}. VPS may be down or network issue.`,
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    }
  }
}

// ═══════════════════════════════════════
//  RUN ALL CHECKS
// ═══════════════════════════════════════

export async function runAllChecks(admin: SupabaseClient): Promise<AlertCandidate[]> {
  const results = await Promise.allSettled([
    // Critical
    checkWebhookDown(admin),
    checkStripeWebhookFail(admin),
    checkBounceRate(admin),
    checkStripeConnectRejected(admin),
    checkWebhookFailSpike(admin),
    checkTrendingClipsFreshness(admin),
    checkYtdlpExtractor(),
    // Important
    checkHotLeadsStale(admin),
    checkDormantAffiliates(admin),
    checkReplyRateDrop(admin),
    checkKycPending(admin),
    checkSuppressionSpike(admin),
  ])

  const alerts: AlertCandidate[] = []
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      alerts.push(result.value)
    } else if (result.status === 'rejected') {
      console.error('[watchdog] Check failed:', result.reason)
    }
  }

  // Mailbox health checks (return multiple alerts)
  try {
    const mailboxAlerts = await checkMailboxHealth()
    alerts.push(...mailboxAlerts)
  } catch (err) {
    console.error('[watchdog] Mailbox health check failed:', err)
  }

  // Silence detection: alert if automation systems haven't heartbeated in 48h
  try {
    const silenceAlerts = await checkAutomationSilence(admin)
    alerts.push(...silenceAlerts)
  } catch (err) {
    console.error('[watchdog] Automation silence check failed:', err)
  }

  return alerts
}

/**
 * Check if nightly audits or lab agent have gone silent (no heartbeat in 48h).
 * Uses lab_agent_status table where both systems write heartbeats.
 */
async function checkAutomationSilence(admin: SupabaseClient): Promise<AlertCandidate[]> {
  const alerts: AlertCandidate[] = []
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: statuses } = await admin
    .from('lab_agent_status')
    .select('id, status, last_heartbeat_at, last_error')

  for (const row of statuses ?? []) {
    const lastBeat = row.last_heartbeat_at ? new Date(row.last_heartbeat_at) : null
    if (!lastBeat || lastBeat.toISOString() < cutoff) {
      const silentDays = lastBeat
        ? Math.round((Date.now() - lastBeat.getTime()) / (24 * 60 * 60 * 1000))
        : 999
      const systemName = row.id === 'singleton' ? 'Lab Agent' : row.id === 'nightly-audits' ? 'Nightly Audits' : row.id
      alerts.push({
        severity: 'critical',
        category: 'automation',
        title: `${systemName} silent for ${silentDays} days`,
        description: `No heartbeat since ${lastBeat?.toISOString().slice(0, 16) ?? 'never'}. Status: ${row.status}. Last error: ${(row.last_error ?? 'none').slice(0, 200)}`,
        metadata: { system: row.id, silentDays, lastStatus: row.status },
      })
    }
  }

  return alerts
}
