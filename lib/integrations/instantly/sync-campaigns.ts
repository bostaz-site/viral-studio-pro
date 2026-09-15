import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { postToDiscord } from '@/lib/discord/post'
import type { InstantlyClient } from './client'
import type { SyncError } from './types'

/**
 * Syncs all active Instantly campaigns → email_campaigns table.
 * Computes positive_reply_rate_pct from reply_bucket data.
 * Pauses campaigns with bounce_rate > 1.5% + Discord alert.
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

  for (const campaign of campaigns) {
    try {
      const analytics = await client.getCampaignAnalytics(campaign.id)
      const sent = analytics.emails_sent || 0
      const bounced = analytics.bounced || 0
      const status = mapCampaignStatus(campaign.status)

      // Compute positive reply count from email_events + influencer reply_bucket
      const totalPositiveReplies = await countPositiveReplies(db, campaign.id)
      const positive_reply_rate_pct = sent > 0
        ? Math.round((totalPositiveReplies / sent) * 10000) / 100
        : null

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
            total_bounced: bounced,
            total_unsubscribed: analytics.unsubscribed || 0,
            total_positive_replies: totalPositiveReplies,
            positive_reply_rate_pct,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'instantly_campaign_id' }
        )

      if (upsertErr) {
        throw new Error(`Upsert campaign failed: ${upsertErr.message}`)
      }

      // Bounce rate health guard: >1.5% → pause + Discord alert
      const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0
      if (bounceRate > 1.5 && status === 'running') {
        await client.pauseCampaign(campaign.id)
        await db
          .from('email_campaigns')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('instantly_campaign_id', campaign.id)

        void sendBounceAlert(campaign.name, bounceRate).catch(() => {})
      }

      synced++
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

/**
 * Count positive replies for a campaign.
 * Joins email_events (campaign_id in metadata) with influencers (reply_bucket).
 */
async function countPositiveReplies(
  db: SupabaseClient,
  instantlyCampaignId: string
): Promise<number> {
  try {
    // Get distinct influencer IDs who replied to this campaign
    const { data: repliedEvents } = await (db as ReturnType<typeof Object>)
      .from('email_events')
      .select('influencer_id')
      .eq('event_type', 'replied')
      .filter('metadata->>campaign_id', 'eq', instantlyCampaignId)
      .not('influencer_id', 'is', null)

    if (!repliedEvents || repliedEvents.length === 0) return 0

    const influencerIds = [...new Set(
      (repliedEvents as Array<{ influencer_id: string }>).map(e => e.influencer_id)
    )]

    // Count how many have positive bucket
    const { count } = await (db as ReturnType<typeof Object>)
      .from('influencers')
      .select('id', { count: 'exact', head: true })
      .in('id', influencerIds)
      .in('reply_bucket', ['interested', 'evaluating'])

    return count ?? 0
  } catch (err) {
    logger.warn({ campaignId: instantlyCampaignId, error: (err as Error).message }, 'Failed to count positive replies')
    return 0
  }
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

async function sendBounceAlert(campaignName: string, bounceRate: number): Promise<void> {
  await postToDiscord({
    channel: 'critical-alerts',
    embed: {
      title: '🔴 Campaign paused — bounce rate exceeded 1.5%',
      description: `**${campaignName}** bounce rate is ${bounceRate.toFixed(1)}%. Campaign auto-paused.`,
      color: 0xef4444,
      fields: [
        { name: 'Campaign', value: campaignName, inline: true },
        { name: 'Bounce Rate', value: `${bounceRate.toFixed(1)}%`, inline: true },
      ],
    },
  })
}
