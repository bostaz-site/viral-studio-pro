import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAndUpsertTwitchClips } from '@/lib/twitch/fetch-clips'
import { withAuth } from '@/lib/api/withAuth'

/**
 * POST /api/streams/refresh
 * User-triggered refresh of Twitch clips.
 */
export const POST = withAuth(async (_req, _user) => {
  try {
    const admin = createAdminClient()
    const result = await fetchAndUpsertTwitchClips(admin)

    return NextResponse.json({
      data: result,
      error: null,
      message: `${result.upserted} clips Twitch importés`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du rafraîchissement'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
})
