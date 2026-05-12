import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { syncInstantlyStats, getSyncStatus } from '@/lib/integrations/instantly/sync'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/sync/instantly
 * Returns the current sync status (last sync time, results, next sync).
 */
export const GET = withAdmin(async () => {
  try {
    const status = await getSyncStatus()

    // Compute next sync (every 15 min from last sync)
    const lastSync = status.last_sync_at ? new Date(status.last_sync_at) : null
    const nextSync = lastSync
      ? new Date(lastSync.getTime() + 15 * 60 * 1000).toISOString()
      : null

    // Get aggregate stats from DB
    const stats = await getAggregateStats()

    return jsonResponse({
      ...status,
      next_sync_at: nextSync,
      stats,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get sync status'
    return errorResponse(message, 500)
  }
})

/**
 * POST /api/admin/sync/instantly
 * Force-triggers an Instantly sync. Admin-only.
 */
export const POST = withAdmin(async () => {
  if (!process.env.INSTANTLY_API_KEY) {
    return errorResponse('INSTANTLY_API_KEY not configured', 500)
  }

  try {
    const result = await syncInstantlyStats()
    logger.info('Admin force-sync Instantly completed')
    return jsonResponse(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    logger.error({ error: message }, 'Admin force-sync Instantly failed')
    return errorResponse(message, 500)
  }
})

// ── Aggregate stats helper ────────────────────────────────────────────────

async function getAggregateStats() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not yet in generated types
  const db = admin as any

  const [mailboxRes, campaignRes] = await Promise.all([
    db
      .from('mailboxes')
      .select('id, reputation_score, status')
      .not('instantly_account_id', 'is', null),
    db
      .from('email_campaigns')
      .select('id, total_sent, total_opened, total_replied, total_bounced, status')
      .not('instantly_campaign_id', 'is', null),
  ])

  const mailboxes: Array<{ status: string; reputation_score: number | null }> =
    mailboxRes.data ?? []
  const campaigns: Array<{ status: string }> = campaignRes.data ?? []

  const activeMailboxes = mailboxes.filter((m) => m.status === 'active' || m.status === 'warming')
  const avgReputation =
    activeMailboxes.length > 0
      ? Math.round(
          activeMailboxes.reduce((sum, m) => sum + (m.reputation_score ?? 70), 0) /
            activeMailboxes.length
        )
      : null

  return {
    total_mailboxes: mailboxes.length,
    active_mailboxes: activeMailboxes.length,
    avg_reputation_score: avgReputation,
    total_campaigns: campaigns.length,
    running_campaigns: campaigns.filter((c) => c.status === 'running').length,
  }
}
