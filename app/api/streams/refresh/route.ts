import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { fetchAndScoreStreamerClips } from '@/lib/twitch/fetch-streamer-clips'
import { withAuth } from '@/lib/api/withAuth'

/**
 * POST /api/streams/refresh
 *
 * User-triggered refresh of Twitch clips.
 * Rate limited to 1 request per minute per user.
 */
export const POST = withAuth(async (req, user) => {
  // Rate limit: 1 per minute per user
  const rl = rateLimit(`streams-refresh:${user.id}`, 1, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
      { status: 429 }
    )
  }

  try {
    const admin = createAdminClient()
    const result = await fetchAndScoreStreamerClips(admin)

    return NextResponse.json({
      data: result,
      error: null,
      message: `${result.upserted} clips importés de ${result.streamers_scanned} streamers`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du rafraîchissement'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
})
