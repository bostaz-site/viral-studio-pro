import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: videos } = await admin
    .from('promo_videos')
    .select('id, title, niche, status')
    .eq('status', 'active')

  if (!videos) return jsonResponse([])

  const stats = await Promise.all(videos.map(async (v) => {
    const { count } = await admin
      .from('video_assignment_log' as never)
      .select('id', { count: 'exact', head: true })
      .eq('promo_video_id' as never, v.id as never)
      .gte('assigned_at' as never, weekAgo as never)

    return {
      videoId: v.id, title: v.title, niche: v.niche,
      assignmentsLast7d: count ?? 0, saturated: (count ?? 0) >= 100,
      remaining: Math.max(0, 100 - (count ?? 0)),
    }
  }))

  return jsonResponse(stats)
})
