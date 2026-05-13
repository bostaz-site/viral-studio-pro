import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeLeadScore } from '@/lib/admin/ai/lead-scorer'

const schema = z.object({
  influencerId: z.string().uuid(),
})

// POST /api/admin/influencers/score — compute lead score for an influencer
export const POST = withAdmin(async (req) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { influencerId } = parsed.data
  const admin = createAdminClient()

  const { data: influencer, error } = await admin
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .single()

  if (error || !influencer) return errorResponse('Influencer not found', 404)

  const result = await computeLeadScore(influencer as Parameters<typeof computeLeadScore>[0])

  // Update influencer lead_score
  await admin
    .from('influencers')
    .update({
      lead_score: result.score,
      lead_score_reasons: result.reasons,
      updated_at: new Date().toISOString(),
    })
    .eq('id', influencerId)

  return jsonResponse(result)
})
