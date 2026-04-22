/**
 * Kick clip fetching pipeline — mirrors Twitch's fetch-streamer-clips.ts.
 * Fetches clips from active Kick streamers, upserts into trending_clips,
 * captures snapshots, and computes scores via the unified scorer.
 */

import { getKickClips } from '@/lib/kick/client'
import { scoreClip } from '@/lib/scoring/clip-scorer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface KickStreamer {
  id: string
  display_name: string
  kick_login: string
  avg_clip_views: number
  avg_clip_velocity: number
}

interface KickFetchResult {
  upserted: number
  snapshots: number
  streamers_scanned: number
  errors: string[]
}

export async function fetchAndScoreKickClips(
  admin: SupabaseClient<Database>,
  clipsPerStreamer = 20
): Promise<KickFetchResult> {
  const result: KickFetchResult = {
    upserted: 0,
    snapshots: 0,
    streamers_scanned: 0,
    errors: [],
  }

  // Load active Kick streamers
  const { data: streamersRaw, error: loadErr } = await admin
    .from('streamers')
    .select('id, display_name, kick_login, avg_clip_views, avg_clip_velocity' as '*')
    .eq('active', true)
    .not('kick_login', 'is', null)
    .order('priority', { ascending: false })

  if (loadErr) {
    result.errors.push(`Load Kick streamers: ${loadErr.message}`)
    return result
  }

  if (!streamersRaw || streamersRaw.length === 0) return result

  const streamers = streamersRaw as unknown as KickStreamer[]

  for (const streamer of streamers) {
    if (!streamer.kick_login) continue

    try {
      const clips = await getKickClips(streamer.kick_login, clipsPerStreamer)
      if (clips.length === 0) {
        result.streamers_scanned++
        continue
      }
      result.streamers_scanned++

      for (const clip of clips) {
        const clipUrl = clip.clip_url || `https://kick.com/${streamer.kick_login}/clips/${clip.id}`

        const clipRow = {
          external_url: clipUrl,
          platform: 'kick' as const,
          author_name: streamer.display_name,
          author_handle: streamer.kick_login,
          title: clip.title,
          description: `${streamer.display_name} · ${Math.round(clip.duration)}s`,
          niche: 'irl',
          view_count: clip.view_count,
          like_count: clip.likes,
          thumbnail_url: clip.thumbnail_url,
          scraped_at: new Date().toISOString(),
          streamer_id: streamer.id,
          twitch_clip_id: null as string | null,
          clip_created_at: clip.created_at,
          duration_seconds: clip.duration,
        }

        const { data: upserted, error: upsertErr } = await admin
          .from('trending_clips')
          .upsert(clipRow, { onConflict: 'external_url' })
          .select('id')
          .single()

        if (upsertErr || !upserted) {
          result.errors.push(
            `${streamer.display_name}/${clip.id}: upsert failed — ${upsertErr?.message ?? 'no row returned'}`
          )
          continue
        }
        result.upserted++

        const clipId = (upserted as { id: string }).id

        // Compute velocity from previous snapshot
        const velocity = await computeKickVelocity(admin, clipId, clip.view_count, clip.created_at)

        // Write snapshot
        await admin
          .from('clip_snapshots')
          .insert({ clip_id: clipId, view_count: clip.view_count })
        result.snapshots++

        // Score using unified scorer
        const ageMs = Date.now() - new Date(clip.created_at).getTime()
        const ageHours = Math.max(0.01, ageMs / 3_600_000)
        const ageMinutes = Math.max(0.1, ageMs / 60_000)

        const scores = scoreClip({
          view_count: clip.view_count,
          like_count: clip.likes,
          clip_age_hours: ageHours,
          clip_age_minutes: ageMinutes,
          velocity,
          streamer_avg_views: streamer.avg_clip_views || 0,
          streamer_avg_velocity: streamer.avg_clip_velocity || 0,
        })

        await admin
          .from('trending_clips')
          .update({
            velocity,
            viral_ratio: velocity / (clip.view_count + 1),
            viral_score: scores.final_score,
            velocity_score: scores.final_score,
            tier: scores.tier,
            early_signal_score: scores.early_signal_score,
            anomaly_score: scores.anomaly_score,
            feed_category: scores.feed_category,
            duration_seconds: clip.duration,
          })
          .eq('id', clipId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${streamer.display_name}: ${msg}`)
    }
  }

  return result
}

async function computeKickVelocity(
  admin: SupabaseClient<Database>,
  clipId: string,
  currentViews: number,
  clipCreatedAt: string
): Promise<number> {
  const { data: prevSnapshot } = await admin
    .from('clip_snapshots')
    .select('view_count, captured_at')
    .eq('clip_id', clipId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prevSnapshot) {
    const hoursElapsed = Math.max(
      0.01,
      (Date.now() - new Date(prevSnapshot.captured_at).getTime()) / 3_600_000
    )
    const deltaViews = Math.max(0, currentViews - prevSnapshot.view_count)
    return deltaViews / hoursElapsed
  }

  const ageHours = Math.max(
    0.1,
    (Date.now() - new Date(clipCreatedAt).getTime()) / 3_600_000
  )
  return currentViews / ageHours
}
