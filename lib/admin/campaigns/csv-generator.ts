import crypto from 'crypto'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

interface CsvRecipient {
  email: string
  first_name: string
  last_name: string
  display_name: string
  platform: string
  niche: string
  audience_size: number
  custom_var_1: string
  unsubscribe_token: string
}

interface Influencer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  primary_platform: string | null
  niche: string | null
  audience_size: number | null
}

export async function generateUnsubscribeToken(
  email: string,
  campaignId?: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClientUntyped()
  await admin.from('unsubscribe_tokens').insert({
    token_hash: tokenHash,
    email,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    source_campaign_id: campaignId ?? null,
  })

  return token
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function generateCampaignCsv(
  influencers: Influencer[],
  campaignId: string
): Promise<{ csv: string; tokenMap: Map<string, string> }> {
  const header = [
    'email',
    'first_name',
    'last_name',
    'display_name',
    'platform',
    'niche',
    'audience_size',
    'custom_var_1',
    'unsubscribe_token',
  ].join(',')

  const tokenMap = new Map<string, string>()
  const rows: string[] = []

  // Generate tokens in batches of 50
  for (let i = 0; i < influencers.length; i += 50) {
    const batch = influencers.slice(i, i + 50)
    const tokens = await Promise.all(
      batch.map((inf) => generateUnsubscribeToken(inf.email, campaignId))
    )

    for (let j = 0; j < batch.length; j++) {
      const inf = batch[j]
      const token = tokens[j]
      tokenMap.set(inf.id, token)

      const row: CsvRecipient = {
        email: inf.email,
        first_name: inf.first_name || '',
        last_name: inf.last_name || '',
        display_name: inf.display_name || inf.first_name || '',
        platform: inf.primary_platform || '',
        niche: inf.niche || '',
        audience_size: inf.audience_size || 0,
        custom_var_1: inf.id,
        unsubscribe_token: token,
      }

      rows.push(
        [
          escapeCsvField(row.email),
          escapeCsvField(row.first_name),
          escapeCsvField(row.last_name),
          escapeCsvField(row.display_name),
          escapeCsvField(row.platform),
          escapeCsvField(row.niche),
          String(row.audience_size),
          escapeCsvField(row.custom_var_1),
          escapeCsvField(row.unsubscribe_token),
        ].join(',')
      )
    }
  }

  return { csv: [header, ...rows].join('\n'), tokenMap }
}

export interface ExportPreviewResult {
  totalSelected: number
  suppressed: number
  duplicates: number
  willExport: number
  allowedInfluencerIds: string[]
}

export async function computeExportPreview(
  selectedInfluencerIds: string[],
  campaignId?: string
): Promise<ExportPreviewResult> {
  const admin = createAdminClientUntyped()

  // 1. Fetch selected influencers
  const { data: influencers } = await admin
    .from('influencers')
    .select('id, email, unsubscribed')
    .in('id', selectedInfluencerIds)

  if (!influencers || influencers.length === 0) {
    return { totalSelected: selectedInfluencerIds.length, suppressed: 0, duplicates: 0, willExport: 0, allowedInfluencerIds: [] }
  }

  // 2. Check suppression list in batch
  const emails = influencers.map((i) => i.email.toLowerCase())
  const { data: suppressedRows } = await admin
    .from('suppression_list')
    .select('email')
    .in('email', emails)
  const suppressedEmails = new Set(
    (suppressedRows || []).map((s) => s.email?.toLowerCase())
  )

  // Also exclude unsubscribed influencers
  const unsubscribedIds = new Set(
    influencers.filter((i) => i.unsubscribed).map((i) => i.id)
  )

  // 3. Check duplicates (already in an active campaign)
  const duplicateIds = new Set<string>()
  if (campaignId) {
    // Exclude influencers already in ANY active campaign (not this one specifically)
    const { data: existingRecipients } = await admin
      .from('campaign_recipients')
      .select('influencer_id, campaign_id')
      .in('influencer_id', selectedInfluencerIds)

    if (existingRecipients) {
      // Get active campaigns
      const campaignIds = [...new Set(existingRecipients.map((r) => r.campaign_id))]
      if (campaignIds.length > 0) {
        const { data: activeCampaigns } = await admin
          .from('email_campaigns')
          .select('id')
          .in('id', campaignIds)
          .in('status', ['draft', 'scheduled', 'running'])
          .neq('id', campaignId)

        const activeCampaignIds = new Set((activeCampaigns || []).map((c) => c.id))
        for (const r of existingRecipients) {
          if (activeCampaignIds.has(r.campaign_id)) {
            duplicateIds.add(r.influencer_id)
          }
        }
      }
    }
  }

  // 4. Compute allowed
  const allowed: string[] = []
  let suppressed = 0
  let duplicates = 0

  for (const inf of influencers) {
    if (suppressedEmails.has(inf.email.toLowerCase()) || unsubscribedIds.has(inf.id)) {
      suppressed++
    } else if (duplicateIds.has(inf.id)) {
      duplicates++
    } else {
      allowed.push(inf.id)
    }
  }

  return {
    totalSelected: selectedInfluencerIds.length,
    suppressed,
    duplicates,
    willExport: allowed.length,
    allowedInfluencerIds: allowed,
  }
}
