import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAssignment } from '@/lib/admin/match-engine/saturation-check'

export const POST = withAdmin(async (req) => {
  const parsed = z.object({ influencerId: z.string().uuid(), promoVideoId: z.string().uuid() }).safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { influencerId, promoVideoId } = parsed.data
  const admin = createAdminClient()

  await admin.from('video_influencer_matches' as never).update({ is_primary: false } as never).eq('influencer_id' as never, influencerId as never).eq('is_primary' as never, true as never)

  await admin.from('video_influencer_matches' as never).upsert({
    influencer_id: influencerId, promo_video_id: promoVideoId,
    match_score: 100, match_breakdown: { manual_override: true },
    is_primary: true, is_admin_override: true,
    computed_at: new Date().toISOString(), expires_at: null,
  } as never, { onConflict: 'influencer_id,promo_video_id' })

  await logAssignment(promoVideoId, influencerId)
  return jsonResponse({ ok: true })
})
