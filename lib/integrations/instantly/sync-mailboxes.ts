import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import type { InstantlyClient } from './client'
import type { SyncError } from './types'

/**
 * Syncs all Instantly email accounts → mailboxes + mailbox_daily_stats.
 * Returns count of synced mailboxes and any per-account errors.
 */
export async function syncMailboxes(
  client: InstantlyClient,
  admin: SupabaseClient
): Promise<{ synced: number; errors: SyncError[] }> {
  const errors: SyncError[] = []

  const accounts = await client.getEmailAccounts()
  logger.info(`Instantly: fetched ${accounts.length} email accounts`)

  let synced = 0
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not yet in generated types
  const db = admin as any

  for (const account of accounts) {
    try {
      // Extract domain from email
      const domain = account.email.split('@')[1] || 'unknown'

      // Map warmup_status to our status enum
      const status = mapAccountStatus(account)

      // UPSERT mailbox
      const { data: mailbox, error: mailboxErr } = await db
        .from('mailboxes')
        .upsert(
          {
            email: account.email,
            display_name: `${account.first_name} ${account.last_name}`.trim() || null,
            domain,
            provider: 'other',
            status,
            instantly_account_id: account.id,
            daily_send_limit: account.daily_limit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select('id')
        .single()

      if (mailboxErr) {
        throw new Error(`Upsert mailbox failed: ${mailboxErr.message}`)
      }

      // UPSERT daily stats
      const { error: statsErr } = await db
        .from('mailbox_daily_stats')
        .upsert(
          {
            mailbox_id: mailbox.id,
            stat_date: today,
          },
          { onConflict: 'mailbox_id,stat_date' }
        )

      if (statsErr) {
        logger.warn({ email: account.email, error: statsErr.message }, 'Failed to upsert daily stats')
      }

      synced++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ email: account.email, error: message }, 'Failed to sync mailbox')
      errors.push({
        entity: 'mailbox',
        id: account.id,
        name: account.email,
        error: message,
      })
    }
  }

  return { synced, errors }
}

function mapAccountStatus(
  account: { warmup_status: string; status: number }
): string {
  if (account.status === 0) return 'blocked'
  switch (account.warmup_status) {
    case 'active':
      return 'warming'
    case 'paused':
      return 'paused'
    case 'disabled':
      return 'active' // Warmup disabled = production-ready
    default:
      return 'active'
  }
}
