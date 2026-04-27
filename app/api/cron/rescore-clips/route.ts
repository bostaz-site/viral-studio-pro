import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { scoreClip } from '@/lib/scoring/clip-scorer'

/**
 * POST /api/cron/rescore-clips
 *
 * Stratified rescoring: picks clips whose next_check_at <= NOW(),
 * recomputes scores from the latest snapshots, writes new snapshots,
 * and schedules the next check based on clip age + spike detection.
 *
 * Uses bulk_update_scores RPC to reduce DB contention (1 call vs N).
 *
 * Auth: x-api-key header = CRON_SECRET
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'API key missing' },
      { status: 401 }
    )
  }

  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Invalid API key' },
      { status: 401 }
    )
  }

  try {
    const admin = createAdminClient()
    const now = new Date()

    // 1. Select clips due for rescoring (NULL next_check_at = highest priority)
    const { data: clips, error: fetchErr } = await admin
      .from('trending_clips')
      .select('id, view_count, like_count, clip_created_at, created_at, title, duration_seconds, velocity, streamer_id')
      .or(`next_check_at.is.null,next_check_at.lte.${now.toISOString()}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(50)

    if (fetchErr) {
      return NextResponse.json(
        { data: null, error: fetchErr.message, message: 'Failed to fetch clips' },
        { status: 500 }
      )
    }

    if (!clips || clips.length === 0) {
      return NextResponse.json({
        data: { rescored: 0, spikes: 0 },
        error: null,
        message: 'No clips due for rescoring',
      })
    }

    // 2. Batch-fetch streamer averages for all unique streamer_ids
    const streamerIds = [...new Set(clips.map(c => c.streamer_id).filter(Boolean))] as string[]
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

    // 3. Batch-fetch snapshots for all clips (1 query instead of N)
    const clipIds = clips.map(c => c.id) as string[]
    const { data: allSnapshots } = await admin
      .from('clip_snapshots')
      .select('clip_id, view_count, captured_at')
      .in('clip_id', clipIds)
      .order('captured_at', { ascending: false })

    // Group by clip_id, keep only 2 most recent per clip
    const snapshotMap = new Map<string, Array<{ view_count: number; captured_at: string }>>()
    for (const s of allSnapshots ?? []) {
      const arr = snapshotMap.get(s.clip_id) ?? []
      if (arr.length < 2) {
        arr.push({ view_count: s.view_count, captured_at: s.captured_at })
        snapshotMap.set(s.clip_id, arr)
      }
    }

    // 4. Score all clips in memory, collect results for bulk operations
    let spikes = 0
    const bulkIds: string[] = []
    const bulkVelocityScores: number[] = []
    const bulkMomentumScores: number[] = []
    const bulkEngagementScores: number[] = []
    const bulkRecencyScores: number[] = []
    const bulkEarlySignalScores: number[] = []
    const bulkFormatScores: number[] = []
    const bulkSaturationScores: number[] = []
    const bulkAnomalyScores: number[] = []
    const bulkTiers: string[] = []
    const bulkFeedCategories: string[] = []
    const bulkNextCheckAts: string[] = []
    const snapshotInserts: Array<{ clip_id: string; view_count: number }> = []

    for (const clip of clips) {
      try {
        const snapshots = snapshotMap.get(clip.id) ?? []
        const latestSnapshot = snapshots[0] ?? null
        const prevSnapshot = snapshots[1] ?? null
        const snapshotCount = snapshots.length

        const currentViews = clip.view_count ?? 0
        const clipCreatedAt = clip.clip_created_at ?? clip.created_at ?? now.toISOString()
        const ageMs = now.getTime() - new Date(clipCreatedAt).getTime()
        const ageHours = Math.max(0.01, ageMs / 3_600_000)
        const ageMinutes = Math.max(0.1, ageMs / 60_000)

        // Compute velocity from snapshots
        let velocity: number
        let prevVelocity: number | undefined

        if (latestSnapshot && prevSnapshot) {
          const deltaHours = Math.max(
            0.01,
            (new Date(latestSnapshot.captured_at).getTime() - new Date(prevSnapshot.captured_at).getTime()) / 3_600_000
          )
          const deltaViews = Math.max(0, latestSnapshot.view_count - prevSnapshot.view_count)
          velocity = deltaViews / deltaHours

          const prevAge = Math.max(
            0.1,
            (new Date(prevSnapshot.captured_at).getTime() - new Date(clipCreatedAt).getTime()) / 3_600_000
          )
          prevVelocity = prevSnapshot.view_count / prevAge
        } else if (latestSnapshot) {
          const snapshotAge = Math.max(
            0.1,
            (now.getTime() - new Date(latestSnapshot.captured_at).getTime()) / 3_600_000
          )
          const deltaViews = Math.max(0, currentViews - latestSnapshot.view_count)
          velocity = deltaViews / snapshotAge
        } else {
          velocity = currentViews / Math.max(0.1, ageHours)
        }

        // Streamer averages
        const streamerAvg = clip.streamer_id ? streamerMap.get(clip.streamer_id) : undefined

        // Score
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

        // Spike detection: current views > last snapshot views * 1.2
        const lastSnapshotViews = latestSnapshot?.view_count ?? 0
        const isSpike = lastSnapshotViews > 0 && currentViews > lastSnapshotViews * 1.2

        // Determine next check interval based on age
        let nextCheckMinutes: number
        if (isSpike) {
          nextCheckMinutes = 5 // Priority: spike detected
          spikes++
        } else if (ageHours < 6) {
          nextCheckMinutes = 15
        } else if (ageHours < 24) {
          nextCheckMinutes = 60
        } else {
          nextCheckMinutes = 1440 // 24 hours
        }

        const nextCheckAt = new Date(now.getTime() + nextCheckMinutes * 60_000).toISOString()

        bulkIds.push(clip.id)
        bulkVelocityScores.push(scores.final_score)
        bulkMomentumScores.push(scores.momentum_score)
        bulkEngagementScores.push(scores.engagement_score)
        bulkRecencyScores.push(scores.recency_score)
        bulkEarlySignalScores.push(scores.early_signal_score)
        bulkFormatScores.push(scores.format_score)
        bulkSaturationScores.push(scores.saturation_score)
        bulkAnomalyScores.push(scores.authority_score)
        bulkTiers.push(scores.tier)
        bulkFeedCategories.push(scores.feed_category)
        bulkNextCheckAts.push(nextCheckAt)
        snapshotInserts.push({ clip_id: clip.id, view_count: currentViews })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[rescore] clip ${clip.id}: ${msg}`)
      }
    }

    // 5. Batch insert snapshots (1 query instead of N)
    if (snapshotInserts.length > 0) {
      const { error: snapErr } = await admin.from('clip_snapshots').insert(snapshotInserts)
      if (snapErr) {
        console.error('[rescore] batch snapshot insert failed:', snapErr.message)
      }
    }

    // 6. Bulk update via RPC (1 query instead of N)
    if (bulkIds.length > 0) {
      const { error: rpcErr } = await (admin.rpc as CallableFunction)('bulk_update_scores', {
        p_ids: bulkIds,
        p_velocity_scores: bulkVelocityScores,
        p_momentum_scores: bulkMomentumScores,
        p_engagement_scores: bulkEngagementScores,
        p_recency_scores: bulkRecencyScores,
        p_early_signal_scores: bulkEarlySignalScores,
        p_format_scores: bulkFormatScores,
        p_saturation_scores: bulkSaturationScores,
        p_anomaly_scores: bulkAnomalyScores,
        p_tiers: bulkTiers,
        p_feed_categories: bulkFeedCategories,
        p_next_check_ats: bulkNextCheckAts,
      })
      if (rpcErr) {
        console.error('[rescore] bulk_update_scores RPC failed:', rpcErr.message)
      }
    }

    return NextResponse.json({
      data: { rescored: bulkIds.length, spikes },
      error: null,
      message: `${bulkIds.length} clips rescored · ${spikes} spikes detected`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}
