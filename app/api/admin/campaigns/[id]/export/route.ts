import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'
import {
  computeExportPreview,
  generateCampaignCsv,
} from '@/lib/admin/campaigns/csv-generator'

const exportSchema = z.object({
  influencer_ids: z.array(z.string().uuid()).min(1).max(10000),
})

// POST - export campaign recipients to CSV
export const POST = withAdmin(async (req, user) => {
  const campaignId = req.nextUrl.pathname.split('/').at(-2)
  if (!campaignId) return errorResponse('Campaign ID required')

  const body = await req.json()
  const parsed = exportSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const admin = createAdminClientUntyped()

  // 1. Verify campaign exists and is in draft state
  const { data: campaign, error: campError } = await admin
    .from('email_campaigns')
    .select('id, status, name')
    .eq('id', campaignId)
    .single()

  if (campError || !campaign) return errorResponse('Campaign not found', 404)
  if (campaign.status !== 'draft') {
    return errorResponse('Can only export draft campaigns')
  }

  // 2. Compute preview (suppression + dedup)
  const preview = await computeExportPreview(parsed.data.influencer_ids, campaignId)

  if (preview.willExport === 0) {
    return errorResponse('No exportable recipients after suppression/dedup filtering')
  }

  // 3. Fetch full influencer data for allowed IDs
  const { data: influencers, error: infError } = await admin
    .from('influencers')
    .select('id, email, first_name, last_name, display_name, primary_platform, niche, audience_size')
    .in('id', preview.allowedInfluencerIds)

  if (infError || !influencers) return errorResponse('Failed to fetch influencers', 500)

  // 4. Generate CSV with unsubscribe tokens
  const { csv, tokenMap } = await generateCampaignCsv(influencers, campaignId)

  // 5. Insert campaign_recipients
  const recipientRows = influencers.map((inf) => ({
    campaign_id: campaignId,
    influencer_id: inf.id,
    status: 'queued' as const,
    sequence_step: 0,
  }))

  // Insert in batches of 500
  for (let i = 0; i < recipientRows.length; i += 500) {
    const batch = recipientRows.slice(i, i + 500)
    const { error: insertError } = await admin
      .from('campaign_recipients')
      .insert(batch)

    if (insertError) {
      // If it's a unique violation, some recipients already exist - skip
      if (insertError.code !== '23505') {
        return errorResponse(`Failed to insert recipients: ${insertError.message}`, 500)
      }
    }
  }

  // 6. Upload CSV to Supabase Storage (private bucket)
  const timestamp = Date.now()
  const storagePath = `${campaignId}/recipients-${timestamp}.csv`
  const { error: uploadError } = await admin.storage
    .from('campaign-exports')
    .upload(storagePath, csv, {
      contentType: 'text/csv',
      upsert: false,
    })

  if (uploadError) {
    console.error('[campaign-export] Storage upload failed:', uploadError.message)
    // Non-blocking: CSV was generated, just return it directly
  }

  // 7. Generate signed download URL (expires in 1 hour)
  let downloadUrl: string | null = null
  if (!uploadError) {
    const { data: signedUrl } = await admin.storage
      .from('campaign-exports')
      .createSignedUrl(storagePath, 3600)
    downloadUrl = signedUrl?.signedUrl || null
  }

  // 8. Update campaign metrics
  await admin
    .from('email_campaigns')
    .update({
      total_recipients: preview.willExport,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  return jsonResponse({
    campaign_id: campaignId,
    total_selected: preview.totalSelected,
    suppressed: preview.suppressed,
    duplicates: preview.duplicates,
    exported: preview.willExport,
    download_url: downloadUrl,
    storage_path: storagePath,
    csv_size_bytes: new Blob([csv]).size,
  })
})
