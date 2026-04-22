import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { scoreClip } from '@/lib/scoring/clip-scorer'

/**
 * POST /api/cron/rescore-clips
 *
 * Stratified rescoring: picks clips whose next_check_at <= NOW(),
 * recomputes scores from the latest snapshots, writes a new snapshot,
 * and schedules the next check based on clip age + spike detection.
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

    // Select clips due for rescoring (NULL next_check_at = highest priority)
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

    // Batch-fetch streamer averages for all unique streamer_ids
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

    let rescored = 0
    let spikes = 0

    for (const clip of clips) {
      try {
        // Fetch the two most recent snapshots for this clip
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

          // Prev velocity needs a third snapshot — approximate from prev snapshot vs clip age
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

        // Write new snapshot for next delta calculation
        await admin
          .from('clip_snapshots')
          .insert({ clip_id: clip.id, view_count: currentViews })

        // Update clip scores + next_check_at
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
            next_check_at: nextCheckAt,
          })
          .eq('id', clip.id)

        rescored++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[rescore] clip ${clip.id}: ${msg}`)
      }
    }

    return NextResponse.json({
      data: { rescored, spikes },
      error: null,
      message: `${rescored} clips rescored · ${spikes} spikes detected`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}
