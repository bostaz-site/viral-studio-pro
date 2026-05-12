import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { getInstantlyClient } from './client'
import { syncMailboxes } from './sync-mailboxes'
import { syncCampaigns } from './sync-campaigns'
import type { SyncResult } from './types'

const SYNC_STATUS_KEY = 'instantly_sync'

/**
 * Main sync orchestrator. Syncs mailboxes then campaigns from Instantly.
 * Stores sync status in a simple key-value approach using Supabase.
 *
 * This is called by both the cron route and the manual force-sync route.
 */
export async function syncInstantlyStats(): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const admin = createAdminClient()

  logger.info('Instantly sync: starting')

  try {
    // Mark sync in progress
    await setSyncMeta(admin, { is_syncing: true, last_sync_started_at: startedAt })

    const instantly = getInstantlyClient()

    // 1. Sync mailboxes
    const mailboxResult = await syncMailboxes(instantly, admin)

    // 2. Sync campaigns
    const campaignResult = await syncCampaigns(instantly, admin)

    const completedAt = new Date().toISOString()
    const allErrors = [...mailboxResult.errors, ...campaignResult.errors]

    const result: SyncResult = {
      success: allErrors.length === 0,
      started_at: startedAt,
      completed_at: completedAt,
      mailboxes_synced: mailboxResult.synced,
      campaigns_synced: campaignResult.synced,
      errors: allErrors,
    }

    // Store result for the status page
    await setSyncMeta(admin, {
      is_syncing: false,
      last_sync_at: completedAt,
      last_sync_result: result,
    })

    logger.info(
      {
        mailboxes: mailboxResult.synced,
        campaigns: campaignResult.synced,
        errors: allErrors.length,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
      'Instantly sync: completed'
    )

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ error: message }, 'Instantly sync: fatal error')

    const completedAt = new Date().toISOString()
    const result: SyncResult = {
      success: false,
      started_at: startedAt,
      completed_at: completedAt,
      mailboxes_synced: 0,
      campaigns_synced: 0,
      errors: [{ entity: 'campaign', id: 'global', name: 'sync', error: message }],
    }

    await setSyncMeta(admin, {
      is_syncing: false,
      last_sync_at: completedAt,
      last_sync_result: result,
    }).catch(() => {}) // Don't let meta write fail mask the real error

    return result
  }
}

/**
 * Get the current sync status for the admin page.
 */
export async function getSyncStatus() {
  const admin = createAdminClient()
  return getSyncMeta(admin)
}

// ── Sync metadata persistence via app_settings table or JSON column ─────

/**
 * We store sync metadata as rows in a lightweight key-value pattern.
 * Using the existing webhook_events table with a special event_type,
 * or a simple approach: store in a JSON column.
 *
 * For simplicity, we use Supabase's built-in storage:
 * We'll store sync state in a dedicated `sync_log` table approach
 * using upsert on a single-row pattern keyed by provider.
 */
async function setSyncMeta(
  admin: ReturnType<typeof createAdminClient>,
  meta: Record<string, unknown>
) {
  // Use RPC or direct upsert on a sync_status row
  // For now, store as a JSON blob in a simple approach
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { error } = await (admin as any)
    .from('sync_log')
    .upsert(
      {
        provider: SYNC_STATUS_KEY,
        metadata: meta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    )

  if (error) {
    // If sync_log table doesn't exist yet, log but don't crash
    logger.warn({ error: error.message }, 'Failed to update sync metadata')
  }
}

async function getSyncMeta(admin: ReturnType<typeof createAdminClient>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { data, error } = await (admin as any)
    .from('sync_log')
    .select('metadata, updated_at')
    .eq('provider', SYNC_STATUS_KEY)
    .single()

  if (error || !data) {
    return {
      is_syncing: false,
      last_sync_at: null,
      last_sync_result: null,
    }
  }

  return data.metadata as {
    is_syncing: boolean
    last_sync_at: string | null
    last_sync_result: SyncResult | null
  }
}
