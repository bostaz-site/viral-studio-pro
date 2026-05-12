import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { computeExportPreview } from '@/lib/admin/campaigns/csv-generator'

const previewSchema = z.object({
  influencer_ids: z.array(z.string().uuid()).min(1).max(10000),
})

// POST - compute export preview (suppression + dedup check)
export const POST = withAdmin(async (req) => {
  const campaignId = req.nextUrl.pathname.split('/').at(-2)
  if (!campaignId) return errorResponse('Campaign ID required')

  const body = await req.json()
  const parsed = previewSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const preview = await computeExportPreview(parsed.data.influencer_ids, campaignId)
  return jsonResponse(preview)
})
