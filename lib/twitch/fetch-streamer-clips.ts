/**
 * Streamer-based clip fetching with viral scoring.
 *
 * Reads active streamers from the `streamers` table, fetches their recent
 * clips via Twitch Helix API, upserts into trending_clips, captures a
 * historical snapshot, and computes viral scoring (velocity + ratio + recency).
 *
 * This replaces the game-based fetch in fetch-clips.ts for our curated list.
 */

import {
  getClipsByBroadcaster,
  getUsersByLogin,
  type TwitchClip,
} from '@/lib/twitch/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface Streamer {
  id: string
  display_name: string
  twitch_login: string
  twitch_id: string | null
  kick_slug: string | null
  priority: number
}

interface StreamerFetchResult {
  upserted: number
  snapshots: number
  streamers_scanned: number
  errors: string[]
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Compute composite viral score from velocity, ratio, and recency.
 *
 *   viral_score = velocity * 0.5 + (viral_ratio * 10000) * 0.3 + recency_boost * 0.2
 *
 * - velocity: views/hour (recent growth)
 * - viral_ratio: velocity / (total_views + 1), scaled
 * - recency_boost: 100 if <6h, linearly decays to 0 at 48h
 *
 * Final score is capped to 0-100.
 */
function computeViralScore(params: {
  velocity: number
  viralRatio: number
  clipCreatedAt: string
}): number {
  const ageHours = Math.max(
    0.1,
    (Date.now() - new Date(params.clipCreatedAt).getTime()) / 3_600_000
  )

  // Recency boost: 100 at 0h, 50 at 24h, 0 at 48h
  const recencyBoost = Math.max(0, 100 - (ageHours * 100) / 48)

  // Velocity component: log-scaled to normalize (10k v/h ≈ 60, 100k ≈ 75)
  const velocityNorm = Math.min(100, 15 * Math.log10(Math.max(1, params.velocity)))

  // Viral ratio component: velocity/views. A high value = growing fast relative
  // to size. We scale by 10000 because this ratio is typically very small (<0.01).
  const ratioNorm = Math.min(100, params.viralRatio * 10000)

  const score =
    velocityNorm * 0.5 + ratioNorm * 0.3 + recencyBoost * 0.2

  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10
}

/**
 * Compute velocity (views/hour) from the most recent previous snapshot.
 * Falls back to total_views / clip_age if no snapshot exists.
 */
async function computeVelocity(
  admin: SupabaseClient<Database>,
  clipId: string,
  currentViews: number,
  clipCreatedAt: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevSnapshot } = await (admin as any)
    .from('clip_snapshots')
    .select('view_count, captured_at')
    .eq('clip_id', clipId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { view_count: number; captured_at: string } | null }

  if (prevSnapshot) {
    const hoursElapsed = Math.max(
      0.01,
      (Date.now() - new Date(prevSnapshot.captured_at).getTime()) / 3_600_000
    )
    const deltaViews = Math.max(0, currentViews - prevSnapshot.view_count)
    return deltaViews / hoursElapsed
  }

  // No snapshot yet — fall back to lifetime velocity
  const ageHours = Math.max(
    0.1,
    (Date.now() - new Date(clipCreatedAt).getTime()) / 3_600_000
  )
  return currentViews / ageHours
}

/**
 * Extract Twitch clip slug from a clip URL.
 * Twitch Helix returns clip.id which is the slug.
 */
function extractSlug(clip: TwitchClip): string {
  return clip.id
}

// ── Streamer resolution ──────────────────────────────────────────────────────

/**
 * Ensure all active streamers have their Twitch broadcaster_id cached in DB.
 * Resolves missing IDs via Helix /users?login=X and writes back.
 */
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

  // Persist resolved IDs back to DB
  const toUpdate = updated.filter(
    (s, i) => s.twitch_id && !streamers[i].twitch_id
  )
  for (const s of toUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('streamers')
      .update({ twitch_id: s.twitch_id })
      .eq('id', s.id)
  }

  return updated
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

  // Load active streamers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: streamersRaw, error: loadErr } = await (admin as any)
    .from('streamers')
    .select('id, display_name, twitch_login, twitch_id, kick_slug, priority')
    .eq('active', true)
    .order('priority', { ascending: false })

  if (loadErr) {
    result.errors.push(`Load streamers: ${loadErr.message}`)
    return result
  }

  if (!streamersRaw || streamersRaw.length === 0) {
    result.errors.push('No active streamers found in streamers table')
    return result
  }

  const streamers = streamersRaw as unknown as Streamer[]

  // Resolve missing twitch_ids (one-time cost per new streamer)
  const resolved = await resolveStreamerIds(admin, streamers)

  // For each streamer, fetch clips and upsert
  for (const streamer of resolved) {
    if (!streamer.twitch_id) {
      result.errors.push(
        `${streamer.display_name}: could not resolve twitch_id for login "${streamer.twitch_login}"`
      )
      continue
    }

    try {
      const clips = await getClipsByBroadcaster(
        streamer.twitch_id,
        lookbackHours,
        clipsPerStreamer
      )
      if (clips.length === 0) {
        result.streamers_scanned++
        continue
      }
      result.streamers_scanned++

      for (const clip of clips) {
        // Upsert the clip (without scores first, we'll compute + update below)
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
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: upserted, error: upsertErr } = await (admin as any)
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

        // Compute velocity from previous snapshot (or lifetime if none)
        const velocity = await computeVelocity(
          admin,
          clipId,
          clip.view_count,
          clip.created_at
        )
        const viralRatio = velocity / (clip.view_count + 1)
        const viralScore = computeViralScore({
          velocity,
          viralRatio,
          clipCreatedAt: clip.created_at,
        })

        // Write snapshot
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('clip_snapshots')
          .insert({ clip_id: clipId, view_count: clip.view_count })
        result.snapshots++

        // Update scoring columns
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('trending_clips')
          .update({
            velocity,
            viral_ratio: viralRatio,
            viral_score: viralScore,
            velocity_score: viralScore, // keep legacy col in sync for existing UI
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

/**
 * Cleanup: delete snapshots older than N days.
 */
export async function cleanupOldSnapshots(
  admin: SupabaseClient<Database>,
  keepDays = 7
): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 86400 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (admin as any)
    .from('clip_snapshots')
    .delete({ count: 'exact' })
    .lt('captured_at', cutoff)
  if (error) throw error
  return count ?? 0
}
