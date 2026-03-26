/**
 * Shared logic for fetching Twitch clips and upserting into trending_clips.
 * Used by both the cron route and the manual refresh endpoint.
 */

import { getTopClips, TRACKED_GAMES, type TwitchClip } from '@/lib/twitch/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const MAX_CLIPS_PER_GAME = 100

interface FetchResult {
  upserted: number
  games: number
  errors: string[]
}

/**
 * Calculate velocity score: views / hours since creation.
 * Higher = faster growth.
 */
function computeVelocityScore(clip: TwitchClip): number {
  const hoursOld = Math.max(0.1, (Date.now() - new Date(clip.created_at).getTime()) / 3_600_000)
  const raw = clip.view_count / hoursOld
  // Normalize to 0-100 scale using log curve
  // ~100 views/hour → ~30, ~1000 → ~55, ~10000 → ~80, ~50000+ → ~95+
  const score = Math.min(100, Math.max(0, 15 * Math.log10(Math.max(1, raw)) + 10))
  return Math.round(score * 10) / 10
}

/**
 * Fetch top clips for all tracked games and upsert into trending_clips.
 */
export async function fetchAndUpsertTwitchClips(
  admin: SupabaseClient<Database>,
  hoursAgo = 6,
  clipsPerGame = 20
): Promise<FetchResult> {
  const result: FetchResult = { upserted: 0, games: 0, errors: [] }

  const gameEntries = Object.entries(TRACKED_GAMES)

  for (const [gameName, { gameId, niche }] of gameEntries) {
    try {
      const clips = await getTopClips(gameId, hoursAgo, clipsPerGame)
      if (clips.length === 0) continue

      result.games++

      // Prepare upsert rows
      const rows = clips.map((clip) => ({
        external_url: clip.url,
        platform: 'twitch' as const,
        author_name: clip.broadcaster_name,
        author_handle: clip.creator_name,
        title: clip.title,
        description: `${gameName} · ${clip.broadcaster_name} · ${Math.round(clip.duration)}s`,
        niche,
        view_count: clip.view_count,
        like_count: null as number | null,
        velocity_score: computeVelocityScore(clip),
        thumbnail_url: clip.thumbnail_url,
        scraped_at: new Date().toISOString(),
      }))

      // Upsert (update if external_url already exists)
      const { error, count } = await admin
        .from('trending_clips')
        .upsert(rows, { onConflict: 'external_url' })

      if (error) {
        result.errors.push(`${gameName}: ${error.message}`)
      } else {
        result.upserted += count ?? rows.length
      }

      // Enforce max clips per game — delete oldest beyond limit
      const { data: existing } = await admin
        .from('trending_clips')
        .select('id, scraped_at')
        .eq('platform', 'twitch')
        .eq('niche', niche)
        .order('scraped_at', { ascending: false })

      if (existing && existing.length > MAX_CLIPS_PER_GAME) {
        const toDelete = existing.slice(MAX_CLIPS_PER_GAME).map((c) => c.id)
        await admin
          .from('trending_clips')
          .delete()
          .in('id', toDelete)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${gameName}: ${msg}`)
    }
  }

  return result
}
