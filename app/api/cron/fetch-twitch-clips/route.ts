import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAndUpsertTwitchClips } from '@/lib/twitch/fetch-clips'

/**
 * POST /api/cron/fetch-twitch-clips
 *
 * Fetches top Twitch clips for tracked games and upserts into trending_clips.
 * Auth: x-api-key header = CRON_SECRET env var
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret || apiKey !== cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Clé API invalide' },
      { status: 401 }
    )
  }

  try {
    const admin = createAdminClient()
    const result = await fetchAndUpsertTwitchClips(admin)

    return NextResponse.json({
      data: result,
      error: null,
      message: `${result.upserted} clips Twitch importés (${result.games} jeux scannés)`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}
