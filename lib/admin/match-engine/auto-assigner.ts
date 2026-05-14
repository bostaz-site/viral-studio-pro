import { createAdminClient } from '@/lib/supabase/admin'
import { computeMatchScore, type MatchResult } from './scorer'
import { getVideoSaturation, logAssignment } from './saturation-check'

const MIN_SCORE = 50
const EXPIRY_DAYS = 14

export interface AssignResult {
  influencerId: string
  matchedVideoId: string | null
  matchScore: number
  isFallback: boolean
  breakdown: MatchResult['breakdown'] | null
}

export async function autoAssignVideo(influencerId: string): Promise<AssignResult> {
  const admin = createAdminClient()

  const { data: influencer } = await admin
    .from('influencers')
    .select('id, niche, tags, audience_size, language, lead_score, primary_platform')
    .eq('id', influencerId)
    .single()

  if (!influencer) return { influencerId, matchedVideoId: null, matchScore: 0, isFallback: true, breakdown: null }

  const { data: videos } = await admin
    .from('promo_videos')
    .select('id, niche, hook_type, language, status')
    .eq('status', 'active')

  if (!videos?.length) return { influencerId, matchedVideoId: null, matchScore: 0, isFallback: true, breakdown: null }

  const scored = videos.map(v => ({
    videoId: v.id,
    result: computeMatchScore(
      { id: v.id, niche: (v.niche as string[]) ?? [], hook_type: v.hook_type, language: v.language },
      { id: influencer.id, niche: influencer.niche, tags: (influencer.tags as string[]) ?? [], audience_size: influencer.audience_size, language: influencer.language, lead_score: influencer.lead_score ?? 0, primary_platform: influencer.primary_platform }
    ),
    isGeneric: !(v.niche as string[])?.length,
  })).sort((a, b) => b.result.score - a.result.score)

  let best: typeof scored[0] | null = null
  for (const c of scored) {
    if (c.result.score < MIN_SCORE && !c.isGeneric) continue
    const sat = await getVideoSaturation(c.videoId)
    if (sat.saturated) continue
    best = c
    break
  }

  const isFallback = !best || best.result.score < MIN_SCORE
  if (!best) {
    const generic = scored.find(s => s.isGeneric)
    if (generic) best = generic
  }

  if (!best) return { influencerId, matchedVideoId: null, matchScore: 0, isFallback: true, breakdown: null }

  // Clear old primary
  await admin.from('video_influencer_matches' as never)
    .update({ is_primary: false } as never)
    .eq('influencer_id' as never, influencerId as never)
    .eq('is_primary' as never, true as never)

  // Upsert new
  await admin.from('video_influencer_matches' as never).upsert({
    influencer_id: influencerId,
    promo_video_id: best.videoId,
    match_score: best.result.score,
    match_breakdown: best.result.breakdown,
    is_primary: true,
    is_admin_override: false,
    computed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  } as never, { onConflict: 'influencer_id,promo_video_id' })

  await logAssignment(best.videoId, influencerId)

  return { influencerId, matchedVideoId: best.videoId, matchScore: best.result.score, isFallback, breakdown: best.result.breakdown }
}

export async function batchAutoAssign(ids: string[]): Promise<AssignResult[]> {
  const results: AssignResult[] = []
  for (const id of ids) results.push(await autoAssignVideo(id))
  return results
}
