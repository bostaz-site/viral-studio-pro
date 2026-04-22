import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreClip } from '@/lib/scoring/clip-scorer'

/**
 * POST /api/admin/rescore-all
 *
 * One-shot bulk rescore of ALL trending clips with Scoring V2.
 * Protected by admin auth. Processes all clips in one request.
 */
export const POST = withAdmin(async () => {
  const admin = createAdminClient()
  const now = new Date()

  // Fetch ALL clips
  const { data: allClips, error: fetchErr } = await admin
    .from('trending_clips')
    .select('id, view_count, like_count, clip_created_at, created_at, title, duration_seconds, velocity, streamer_id, tier')
    .order('created_at', { ascending: false })

  if (fetchErr) return errorResponse(fetchErr.message, 500)
  if (!allClips || allClips.length === 0) return jsonResponse({ rescored: 0, tierChanges: {} })

  // Batch-fetch streamer averages
  const streamerIds = [...new Set(allClips.map(c => c.streamer_id).filter(Boolean))] as string[]
  const streamerMap = new Map<string, { avg_clip_views: number; avg_clip_velocity: number }>()

  if (streamerIds.length > 0) {
    const { data: streamers } = await admin
      .from('streamers')
      .select('id, avg_clip_views, avg_clip_velocity')
      .in('id', streamerIds)

    if (streamers) {
      for (const s of streamers) {
        streamerMap.set(s.id, {
          avg_clip_views: (s.avg_clip_views as number) ?? 0,
          avg_clip_velocity: (s.avg_clip_velocity as number) ?? 0,
        })
      }
    }
  }

  let rescored = 0
  const tierChanges: Record<string, number> = {}

  for (const clip of allClips) {
    try {
      // Fetch snapshots for velocity
      const { data: snapshots } = await admin
        .from('clip_snapshots')
        .select('view_count, captured_at')
        .eq('clip_id', clip.id)
        .order('captured_at', { ascending: false })
        .limit(2)

      const latestSnapshot = snapshots?.[0] ?? null
      const prevSnapshot = snapshots?.[1] ?? null
      const snapshotCount = snapshots?.length ?? 0

      const currentViews = clip.view_count ?? 0
      const clipCreatedAt = clip.clip_created_at ?? clip.created_at ?? now.toISOString()
      const ageMs = now.getTime() - new Date(clipCreatedAt).getTime()
      const ageHours = Math.max(0.01, ageMs / 3_600_000)
      const ageMinutes = Math.max(0.1, ageMs / 60_000)

      let velocity: number
      let prevVelocity: number | undefined

      if (latestSnapshot && prevSnapshot) {
        const deltaHours = Math.max(0.01,
          (new Date(latestSnapshot.captured_at).getTime() - new Date(prevSnapshot.captured_at).getTime()) / 3_600_000
        )
        velocity = Math.max(0, latestSnapshot.view_count - prevSnapshot.view_count) / deltaHours
        const prevAge = Math.max(0.1,
          (new Date(prevSnapshot.captured_at).getTime() - new Date(clipCreatedAt).getTime()) / 3_600_000
        )
        prevVelocity = prevSnapshot.view_count / prevAge
      } else if (latestSnapshot) {
        const snapshotAge = Math.max(0.1,
          (now.getTime() - new Date(latestSnapshot.captured_at).getTime()) / 3_600_000
        )
        velocity = Math.max(0, currentViews - latestSnapshot.view_count) / snapshotAge
      } else {
        velocity = currentViews / Math.max(0.1, ageHours)
      }

      const streamerAvg = clip.streamer_id ? streamerMap.get(clip.streamer_id) : undefined

      const scores = scoreClip({
        view_count: currentViews,
        like_count: clip.like_count ?? 0,
        clip_age_hours: ageHours,
        clip_age_minutes: ageMinutes,
        velocity,
        streamer_avg_views: streamerAvg?.avg_clip_views ?? 0,
        streamer_avg_velocity: streamerAvg?.avg_clip_velocity ?? 0,
        title: clip.title ?? undefined,
        duration_seconds: clip.duration_seconds ?? undefined,
        snapshot_count: snapshotCount,
        prev_velocity: prevVelocity,
      })

      // Track tier change
      const oldTier = clip.tier ?? 'unknown'
      const newTier = scores.tier
      if (oldTier !== newTier) {
        const key = `${oldTier} → ${newTier}`
        tierChanges[key] = (tierChanges[key] ?? 0) + 1
      }

      // Compute next_check_at based on age
      let nextCheckMinutes: number
      if (ageHours < 6) nextCheckMinutes = 15
      else if (ageHours < 24) nextCheckMinutes = 60
      else nextCheckMinutes = 1440

      await admin
        .from('trending_clips')
        .update({
          velocity,
          viral_ratio: velocity / (currentViews + 1),
          viral_score: scores.final_score,
          velocity_score: scores.final_score,
          tier: scores.tier,
          early_signal_score: scores.early_signal_score,
          // NOTE: DB column is 'anomaly_score' but stores authority_score from Scoring V2
          anomaly_score: scores.authority_score,
          feed_category: scores.feed_category,
          momentum_score: scores.momentum_score,
          engagement_score: scores.engagement_score,
          recency_score: scores.recency_score,
          format_score: scores.format_score,
          saturation_score: scores.saturation_score,
          next_check_at: new Date(now.getTime() + nextCheckMinutes * 60_000).toISOString(),
        })
        .eq('id', clip.id)

      rescored++
    } catch (err) {
      console.error(`[rescore-all] clip ${clip.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const totalTierChanges = Object.values(tierChanges).reduce((a, b) => a + b, 0)

  return jsonResponse({
    rescored,
    total: allClips.length,
    tierChanges,
    totalTierChanges,
    message: `${rescored}/${allClips.length} clips rescored with V2. ${totalTierChanges} tier changes.`,
  })
})
