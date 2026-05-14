import { createAdminClient } from '@/lib/supabase/admin'

const MAX_PER_WEEK = 100

export async function getVideoSaturation(videoId: string) {
  const admin = createAdminClient()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('video_assignment_log' as never)
    .select('id', { count: 'exact', head: true })
    .eq('promo_video_id' as never, videoId as never)
    .gte('assigned_at' as never, weekAgo as never)

  const c = count ?? 0
  return { count: c, saturated: c >= MAX_PER_WEEK, remaining: Math.max(0, MAX_PER_WEEK - c) }
}

export async function logAssignment(videoId: string, influencerId: string) {
  const admin = createAdminClient()
  await admin.from('video_assignment_log' as never).insert({
    promo_video_id: videoId, influencer_id: influencerId,
  } as never)
}
