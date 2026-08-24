import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Static fallback when DB is unreachable */
const FALLBACK = {
  clips: [
    { title: 'MOST INSANE CLUTCH OF THE YEAR', author_handle: 'shroud', velocity_score: 91, feed_category: 'hot_now', thumbnail_url: null, clip_created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
    { title: 'WHAT DID I JUST WITNESS', author_handle: 'xqc', velocity_score: 84, feed_category: 'early_gem', thumbnail_url: null, clip_created_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
    { title: 'THIS PLAY BROKE CHAT', author_handle: 'kamet0', velocity_score: 79, feed_category: 'hot_now', thumbnail_url: null, clip_created_at: new Date(Date.now() - 5 * 3600_000).toISOString() },
    { title: 'UNSTOPPABLE STREAK', author_handle: 'sardoche', velocity_score: 76, feed_category: 'hot_now', thumbnail_url: null, clip_created_at: new Date(Date.now() - 7 * 3600_000).toISOString() },
  ],
  totalAnalyzed: 8800,
}

/**
 * GET /api/landing/radar — Public, cached (ISR 15min).
 * Returns top 4 eligible clips for the landing page radar section.
 */
export async function GET() {
  try {
    const admin = createAdminClient()

    // Top 4 clips eligible for radar — with timeout to prevent landing page stalls
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600_000).toISOString()
    const { data: clips } = await admin
      .from('trending_clips')
      .select('title, author_handle, velocity_score, feed_category, thumbnail_url, clip_created_at')
      .gte('velocity_score', 65)
      .gte('clip_created_at', twelveHoursAgo)
      .gte('duration_seconds', 8)
      .order('velocity_score', { ascending: false })
      .limit(4)
      .abortSignal(AbortSignal.timeout(8000)) // 8s max — fallback on slow DB

    // Total clips analyzed (rounded down to nearest 100)
    const { count } = await admin
      .from('trending_clips')
      .select('id', { count: 'exact', head: true })
      .abortSignal(AbortSignal.timeout(5000))

    const totalAnalyzed = count ? Math.floor(count / 100) * 100 : FALLBACK.totalAnalyzed

    if (!clips || clips.length === 0) {
      return jsonWithCache({ data: { ...FALLBACK, totalAnalyzed } })
    }

    return jsonWithCache({
      data: {
        clips: clips.map((c) => ({
          title: c.title,
          author_handle: c.author_handle,
          velocity_score: c.velocity_score,
          feed_category: c.feed_category,
          thumbnail_url: c.thumbnail_url,
          clip_created_at: c.clip_created_at,
        })),
        totalAnalyzed,
      },
    })
  } catch {
    return jsonWithCache({ data: FALLBACK })
  }
}

/** Return JSON with a short CDN cache (60s fresh, 5min stale-while-revalidate) */
function jsonWithCache(body: unknown) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
