import { createAdminClient } from '@/lib/supabase/admin'

interface MailboxHealthAlert {
  severity: 'critical' | 'important' | 'info'
  category: string
  title: string
  description: string
  metadata: Record<string, string>
}

const STALE_STATE_KEY = 'watchdog_mailbox_stale'

/**
 * Run mailbox-specific health checks.
 * Called by the watchdog cron alongside existing checks.
 *
 * Sync-stale alerts are aggregated ("N mailboxes sync stale") and fire
 * only on state change (healthy→stale or stale→healthy), not every run.
 * Per-mailbox alerts (reputation, bounce, daily limit) still fire individually.
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
  const staleEmails: string[] = []

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

    // 6. Collect stale mailboxes (aggregated below, not per-mailbox)
    if (hoursSinceSync > 6) {
      staleEmails.push(mb.email)
    }
  }

  // ── Aggregated sync-stale alert (state-change only) ────────────────────
  const currentStaleCount = staleEmails.length
  const previousStaleCount = await getLastStaleCount(supabase)
  await setStaleCount(supabase, currentStaleCount)

  if (currentStaleCount > 0 && previousStaleCount === 0) {
    // Transition: healthy → stale
    alerts.push({
      severity: 'critical',
      category: 'mailbox',
      title: `${currentStaleCount} mailboxes sync stale`,
      description: `Mailboxes not synced in 6+ hours: ${staleEmails.join(', ')}. Check Instantly integration.`,
      metadata: { count: String(currentStaleCount), emails: staleEmails.join(', ') },
    })
  } else if (currentStaleCount === 0 && previousStaleCount > 0) {
    // Transition: stale → healthy
    alerts.push({
      severity: 'info',
      category: 'mailbox',
      title: 'Mailbox sync recovered',
      description: `All mailboxes are now syncing normally. Previously ${previousStaleCount} were stale.`,
      metadata: { previous_count: String(previousStaleCount) },
    })
  }
  // Both > 0 or both == 0: no alert (no state change)

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

// ── Stale-state persistence (sync_log table, key=watchdog_mailbox_stale) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync_log not in generated types
async function getLastStaleCount(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await (supabase as any)
    .from('sync_log')
    .select('metadata')
    .eq('provider', STALE_STATE_KEY)
    .single()

  const meta = data?.metadata as { stale_count?: number } | null
  return meta?.stale_count ?? 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync_log not in generated types
async function setStaleCount(supabase: ReturnType<typeof createAdminClient>, count: number): Promise<void> {
  await (supabase as any)
    .from('sync_log')
    .upsert(
      {
        provider: STALE_STATE_KEY,
        metadata: { stale_count: count },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    )
}
