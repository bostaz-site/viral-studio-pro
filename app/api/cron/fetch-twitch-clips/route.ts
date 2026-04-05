import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { fetchAndScoreStreamerClips, cleanupOldSnapshots } from '@/lib/twitch/fetch-streamer-clips'

/**
 * POST /api/cron/fetch-twitch-clips
 *
 * Fetches recent Twitch clips for every active streamer in the `streamers`
 * table, upserts them into trending_clips, captures a historical snapshot
 * (for velocity computation), and updates viral scoring columns.
 *
 * Should run every 15-20 minutes.
 *
 * Auth: x-api-key header = CRON_SECRET env var
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Clé API manquante' },
      { status: 401 }
    )
  }

  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Clé API invalide' },
      { status: 401 }
    )
  }

  try {
    const admin = createAdminClient()
    const result = await fetchAndScoreStreamerClips(admin, 48, 20)

    // Opportunistic cleanup of old snapshots (keep 7 days)
    let cleaned = 0
    try {
      cleaned = await cleanupOldSnapshots(admin, 7)
    } catch { /* non-fatal */ }

    return NextResponse.json({
      data: { ...result, snapshots_cleaned: cleaned },
      error: null,
      message: `${result.upserted} clips importés · ${result.streamers_scanned} streamers · ${result.snapshots} snapshots`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}

// Also expose GET for easy manual triggering from browser (with query param auth)
export async function GET(req: NextRequest) {
  return POST(req)
}
