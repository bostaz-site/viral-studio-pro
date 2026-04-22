/**
 * Streamer-based clip fetching with unified viral scoring (V2).
 *
 * Reads active streamers from the `streamers` table, fetches their recent
 * clips via Twitch Helix API, upserts into trending_clips, captures a
 * historical snapshot, and computes scores via the unified clip-scorer.
 */

import {
  getClipsByBroadcaster,
  getUsersByLogin,
  type TwitchClip,
} from '@/lib/twitch/client'
import { scoreClip } from '@/lib/scoring/clip-scorer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface Streamer {
  id: string
  display_name: string
  twitch_login: string
  twitch_id: string | null
  kick_slug: string | null
  priority: number
  avg_clip_views: number
  avg_clip_velocity: number
}

interface StreamerFetchResult {
  upserted: number
  snapshots: number
  streamers_scanned: number
  errors: string[]
}

// ── Velocity computation ─────────────────────────────────────────────────────

async function computeVelocity(
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

function extractSlug(clip: TwitchClip): string {
  return clip.id
}

// ── Streamer resolution ──────────────────────────────────────────────────────

async function resolveStreamerIds(
  admin: SupabaseClient<Database>,
  streamers: Streamer[]
): Promise<Streamer[]> {
  const needsResolution = streamers.filter(
    (s) => !s.twitch_id && s.twitch_login
  )
  if (needsResolution.length === 0) return streamers

  const logins = needsResolution.map((s) => s.twitch_login)
  const users = await getUsersByLogin(logins)

  const loginToId = new Map(users.map((u) => [u.login.toLowerCase(), u.id]))

  const updated = streamers.map((s) => {
    if (s.twitch_id) return s
    const id = loginToId.get(s.twitch_login.toLowerCase())
    return id ? { ...s, twitch_id: id } : s
  })

  const toUpdate = updated.filter(
    (s, i) => s.twitch_id && !streamers[i].twitch_id
  )
  for (const s of toUpdate) {
    await admin
      .from('streamers')
      .update({ twitch_id: s.twitch_id })
      .eq('id', s.id)
  }

  return updated
}

// ── Streamer average update ──────────────────────────────────────────────────

async function updateStreamerAverages(
  admin: SupabaseClient<Database>,
  streamerId: string
): Promise<void> {
  const { data: clips } = await admin
    .from('trending_clips')
    .select('view_count, velocity')
    .eq('streamer_id', streamerId)
    .order('scraped_at', { ascending: false })
    .limit(50)

  if (!clips || clips.length === 0) return

  const avgViews = clips.reduce((s, c) => s + (c.view_count ?? 0), 0) / clips.length
  const avgVelocity = clips.reduce((s, c) => s + (c.velocity ?? 0), 0) / clips.length

  await admin
    .from('streamers')
    .update({
      avg_clip_views: Math.round(avgViews),
      avg_clip_velocity: Math.round(avgVelocity * 100) / 100,
      total_clips_tracked: clips.length,
    })
    .eq('id', streamerId)
}

// ── Main fetch loop ──────────────────────────────────────────────────────────

export async function fetchAndScoreStreamerClips(
  admin: SupabaseClient<Database>,
  lookbackHours = 48,
  clipsPerStreamer = 20
): Promise<StreamerFetchResult> {
  const result: StreamerFetchResult = {
    upserted: 0,
    snapshots: 0,
    streamers_scanned: 0,
    errors: [],
  }

  const { data: streamersRaw, error: loadErr } = await admin
    .from('streamers')
    .select('id, display_name, twitch_login, twitch_id, kick_slug, priority, avg_clip_views, avg_clip_velocity' as '*')
    .eq('active', true)
    .not('twitch_login', 'is', null)
    .order('priority', { ascending: false })

  if (loadErr) {
    result.errors.push(`Load streamers: ${loadErr.message}`)
    return result
  }

  if (!streamersRaw || streamersRaw.length === 0) {
    result.errors.push('No active Twitch streamers found')
    return result
  }

  // Cast needed: Supabase generic select returns a union of all table rows.
  // Our Streamer interface matches the actual columns selected above.
  const streamers = streamersRaw as unknown as Streamer[]
  const resolved = await resolveStreamerIds(admin, streamers)

  for (const streamer of resolved) {
    if (!streamer.twitch_id) {
      result.errors.push(
        `${streamer.display_name}: could not resolve twitch_id for login "${streamer.twitch_login}"`
      )
      continue
    }

    try {
      const rawClips = await getClipsByBroadcaster(
        streamer.twitch_id,
        lookbackHours,
        clipsPerStreamer
      )
      if (rawClips.length === 0) {
        result.streamers_scanned++
        continue
      }
      result.streamers_scanned++

      // Deduplicate: keep only the highest-view clip per title within this batch.
      // Twitch streams produce multiple clips with the same stream title.
      const bestByTitle = new Map<string, typeof rawClips[number]>()
      for (const c of rawClips) {
        const key = (c.title || c.id).toLowerCase()
        const existing = bestByTitle.get(key)
        if (!existing || c.view_count > existing.view_count) {
          bestByTitle.set(key, c)
        }
      }
      const clips = Array.from(bestByTitle.values())

      for (const clip of clips) {
        const clipRow = {
          external_url: clip.url,
          platform: 'twitch' as const,
          author_name: clip.broadcaster_name || streamer.display_name,
          author_handle: streamer.twitch_login,
          title: clip.title,
          description: `${streamer.display_name} · ${Math.round(clip.duration)}s`,
          niche: 'irl',
          view_count: clip.view_count,
          like_count: null as number | null,
          thumbnail_url: clip.thumbnail_url,
          scraped_at: new Date().toISOString(),
          streamer_id: streamer.id,
          twitch_clip_id: extractSlug(clip),
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

        const velocity = await computeVelocity(
          admin,
          clipId,
          clip.view_count,
          clip.created_at
        )

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
          like_count: 0,
          clip_age_hours: ageHours,
          clip_age_minutes: ageMinutes,
          velocity,
          streamer_avg_views: streamer.avg_clip_views || 0,
          streamer_avg_velocity: streamer.avg_clip_velocity || 0,
          title: clip.title,
          duration_seconds: clip.duration,
        })

        // Fresh clip → recheck in 15 minutes
        const nextCheckAt = new Date(Date.now() + 15 * 60_000).toISOString()

        await admin
          .from('trending_clips')
          .update({
            velocity,
            viral_ratio: velocity / (clip.view_count + 1),
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
          .eq('id', clipId)
      }

      // Update streamer averages
      await updateStreamerAverages(admin, streamer.id)

      // Mark last fetched
      await admin
        .from('streamers')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', streamer.id)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${streamer.display_name}: ${msg}`)
    }
  }

  return result
}

/**
 * Cleanup: delete snapshots older than N days.
 */
export async function cleanupOldSnapshots(
  admin: SupabaseClient<Database>,
  keepDays = 7
): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 86400 * 1000).toISOString()
  const { error, count } = await admin
    .from('clip_snapshots')
    .delete({ count: 'exact' })
    .lt('captured_at', cutoff)
  if (error) throw error
  return count ?? 0
}
