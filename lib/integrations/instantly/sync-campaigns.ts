import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import type { InstantlyClient } from './client'
import type { SyncError } from './types'

/**
 * Syncs all active Instantly campaigns → email_campaigns table.
 * Fetches analytics per campaign to update metrics.
 * Returns count of synced campaigns and any per-campaign errors.
 */
export async function syncCampaigns(
  client: InstantlyClient,
  admin: SupabaseClient
): Promise<{ synced: number; errors: SyncError[] }> {
  const errors: SyncError[] = []

  const campaigns = await client.getCampaigns()
  logger.info(`Instantly: fetched ${campaigns.length} campaigns`)

  let synced = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const db = admin as any

  // Process campaigns sequentially to respect rate limits
  for (const campaign of campaigns) {
    try {
      // Fetch analytics for this campaign
      const analytics = await client.getCampaignAnalytics(campaign.id)

      const sent = analytics.emails_sent || 0

      // Map Instantly status to our schema status
      const status = mapCampaignStatus(campaign.status)

      // UPSERT email_campaign by instantly_campaign_id
      const { error: upsertErr } = await db
        .from('email_campaigns')
        .upsert(
          {
            instantly_campaign_id: campaign.id,
            name: campaign.name,
            status,
            total_recipients: analytics.total_leads || 0,
            total_sent: sent,
            total_opened: analytics.emails_read || 0,
            total_replied: analytics.leads_replied || 0,
            total_bounced: analytics.bounced || 0,
            total_unsubscribed: analytics.unsubscribed || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'instantly_campaign_id' }
        )

      if (upsertErr) {
        throw new Error(`Upsert campaign failed: ${upsertErr.message}`)
      }

      synced++

      // Small delay between analytics calls to respect rate limits
      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ campaignId: campaign.id, name: campaign.name, error: message }, 'Failed to sync campaign')
      errors.push({
        entity: 'campaign',
        id: campaign.id,
        name: campaign.name,
        error: message,
      })
    }
  }

  return { synced, errors }
}

function mapCampaignStatus(status: string): string {
  switch (status) {
    case 'active':
      return 'running'
    case 'paused':
      return 'paused'
    case 'completed':
      return 'completed'
    case 'draft':
      return 'draft'
    default:
      return 'draft'
  }
}
