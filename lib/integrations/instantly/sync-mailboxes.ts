import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import type { InstantlyClient } from './client'
import type { InstantlyEmailAccount } from './types'
import type { SyncError } from './types'
import { postToDiscord } from '@/lib/discord/post'

const ZOHO_DOMAINS = [
  'viralanimal.online',
  'viralanimal.site',
  'viralanimal.space',
  'viralanimal.store',
]

const DFY_DOMAINS = [
  'getviralanimal.com',
  'tryviralanimal.com',
  'viralanimalhq.com',
  'useviralanimal.com',
]

/**
 * Syncs all Instantly email accounts → mailboxes + mailbox_daily_stats.
 * DFY Google boxes: provider='google', daily_send_limit=12.
 * Zoho boxes: status='reception_only', daily_send_limit=0.
 * Warmup score <70 → pause + Discord alert.
 */
export async function syncMailboxes(
  client: InstantlyClient,
  admin: SupabaseClient
): Promise<{ synced: number; errors: SyncError[] }> {
  const errors: SyncError[] = []

  const accounts = await client.getEmailAccounts()
  logger.info(`Instantly: fetched ${accounts.length} email accounts`)

  let synced = 0
  const today = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not yet in generated types
  const db = admin as any

  for (const account of accounts) {
    try {
      const domain = account.email.split('@')[1] || 'unknown'
      const isZoho = ZOHO_DOMAINS.includes(domain)
      const isDfy = DFY_DOMAINS.includes(domain)

      const provider = isZoho ? 'zoho' : isDfy ? 'google' : 'other'
      const dailySendLimit = isZoho ? 0 : isDfy ? 12 : account.daily_limit
      const status = isZoho ? 'reception_only' : mapAccountStatus(account)
      const warmupScore = account.warmup_score ?? null

      // UPSERT mailbox
      const { data: mailbox, error: mailboxErr } = await db
        .from('mailboxes')
        .upsert(
          {
            email: account.email,
            display_name: `${account.first_name} ${account.last_name}`.trim() || null,
            domain,
            provider,
            status,
            instantly_account_id: account.id,
            daily_send_limit: dailySendLimit,
            warmup_score: warmupScore,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select('id')
        .single()

      if (mailboxErr) {
        throw new Error(`Upsert mailbox failed: ${mailboxErr.message}`)
      }

      // Warmup guard: score <70 → pause + alert
      if (warmupScore !== null && warmupScore < 70 && !isZoho) {
        await client.pauseEmailAccount(account.id)

        await db
          .from('mailboxes')
          .update({
            warmup_paused_at: new Date().toISOString(),
            status: 'paused',
          })
          .eq('id', mailbox.id)

        void sendWarmupAlert(account.email, warmupScore).catch(() => {})
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
  account: Pick<InstantlyEmailAccount, 'warmup_status' | 'status'>
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

async function sendWarmupAlert(email: string, score: number): Promise<void> {
  await postToDiscord({
    channel: 'critical-alerts',
    embed: {
      title: '⚠️ Warmup score below threshold',
      description: `**${email}** warmup score is ${score}% (threshold: 70%). Account paused.`,
      color: 0xf59e0b,
      fields: [
        { name: 'Email', value: email, inline: true },
        { name: 'Score', value: `${score}%`, inline: true },
      ],
    },
  })
}
