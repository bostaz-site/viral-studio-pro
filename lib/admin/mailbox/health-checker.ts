import { createAdminClient } from '@/lib/supabase/admin'

interface MailboxHealthAlert {
  severity: 'critical' | 'important'
  category: string
  title: string
  description: string
  metadata: Record<string, string>
}

/**
 * Run mailbox-specific health checks.
 * Called by the watchdog cron alongside existing checks.
 */
export async function checkMailboxHealth(): Promise<MailboxHealthAlert[]> {
  const supabase = createAdminClient()
  const alerts: MailboxHealthAlert[] = []

  const { data: mailboxes } = await supabase
    .from('mailboxes')
    .select('id, email, status, reputation_score, bounce_rate_pct, daily_send_limit, emails_sent_today, updated_at')
    .in('status', ['active', 'warming'])

  if (!mailboxes?.length) return alerts

  const now = Date.now()

  for (const mb of mailboxes) {
    const rep = mb.reputation_score ?? 100
    const bounce = mb.bounce_rate_pct ?? 0
    const sent = mb.emails_sent_today ?? 0
    const limit = mb.daily_send_limit ?? 30
    const lastUpdate = mb.updated_at ? new Date(mb.updated_at).getTime() : 0
    const hoursSinceSync = (now - lastUpdate) / (1000 * 60 * 60)

    // 1. Reputation < 50 → critical
    if (rep < 50) {
      alerts.push({
        severity: 'critical',
        category: 'mailbox',
        title: `Mailbox ${mb.email} reputation critical (${rep})`,
        description: `Reputation score dropped to ${rep}. Consider pausing this mailbox immediately.`,
        metadata: { mailbox_id: mb.id, mailbox_email: mb.email, reputation: String(rep) },
      })
    }
    // 2. Reputation < 70 → important
    else if (rep < 70) {
      alerts.push({
        severity: 'important',
        category: 'mailbox',
        title: `Mailbox ${mb.email} reputation low (${rep})`,
        description: `Reputation score is ${rep}. Monitor closely and reduce volume.`,
        metadata: { mailbox_id: mb.id, mailbox_email: mb.email, reputation: String(rep) },
      })
    }

    // 3. Bounce rate > 5% → critical
    if (bounce > 5) {
      alerts.push({
        severity: 'critical',
        category: 'mailbox',
        title: `Mailbox ${mb.email} bounce rate ${bounce.toFixed(1)}%`,
        description: `Bounce rate exceeds 5%. Pause sending and clean your list.`,
        metadata: { mailbox_id: mb.id, mailbox_email: mb.email, bounce_rate: String(bounce) },
      })
    }
    // 4. Bounce rate > 3% → important
    else if (bounce > 3) {
      alerts.push({
        severity: 'important',
        category: 'mailbox',
        title: `Mailbox ${mb.email} bounce rate elevated (${bounce.toFixed(1)}%)`,
        description: `Bounce rate is above 3%. Review your recipient list quality.`,
        metadata: { mailbox_id: mb.id, mailbox_email: mb.email, bounce_rate: String(bounce) },
      })
    }

    // 5. Approaching daily limit (> 90%)
    if (limit > 0 && sent > limit * 0.9) {
      alerts.push({
        severity: 'important',
        category: 'mailbox',
        title: `Mailbox ${mb.email} near daily limit (${sent}/${limit})`,
        description: `${Math.round((sent / limit) * 100)}% of daily send limit used.`,
        metadata: { mailbox_id: mb.id, mailbox_email: mb.email, sent: String(sent), limit: String(limit) },
      })
    }

    // 6. No sync in > 6 hours → critical
    if (hoursSinceSync > 6) {
      alerts.push({
        severity: 'critical',
        category: 'mailbox',
        title: `Mailbox ${mb.email} sync stale (${Math.round(hoursSinceSync)}h)`,
        description: `No sync data received in ${Math.round(hoursSinceSync)} hours. Check Instantly integration.`,
        metadata: { mailbox_id: mb.id, mailbox_email: mb.email, hours_since_sync: String(Math.round(hoursSinceSync)) },
      })
    }
  }

  // 7. Reputation drop > 15 points in 24h
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: yesterdayStats } = await supabase
    .from('mailbox_daily_stats')
    .select('mailbox_id, reputation_score')
    .eq('stat_date', yesterday)

  if (yesterdayStats?.length) {
    const yesterdayMap = new Map(yesterdayStats.map(s => [s.mailbox_id, s.reputation_score ?? 100]))

    const { data: todayStats } = await supabase
      .from('mailbox_daily_stats')
      .select('mailbox_id, reputation_score')
      .eq('stat_date', today)

    for (const ts of todayStats ?? []) {
      const prevScore = yesterdayMap.get(ts.mailbox_id)
      const currentScore = ts.reputation_score ?? 100
      if (prevScore && prevScore - currentScore > 15) {
        const mb = mailboxes.find(m => m.id === ts.mailbox_id)
        alerts.push({
          severity: 'critical',
          category: 'mailbox',
          title: `Mailbox ${mb?.email ?? ts.mailbox_id} reputation dropped ${prevScore - currentScore} pts`,
          description: `Reputation went from ${prevScore} to ${currentScore} in 24h. Investigate immediately.`,
          metadata: { mailbox_id: ts.mailbox_id, prev_score: String(prevScore), current_score: String(currentScore) },
        })
      }
    }
  }

  return alerts
}
