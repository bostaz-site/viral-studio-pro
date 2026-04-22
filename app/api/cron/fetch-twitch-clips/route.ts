import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { fetchAndScoreStreamerClips, cleanupOldSnapshots } from '@/lib/twitch/fetch-streamer-clips'
import { fetchAndScoreKickClips } from '@/lib/kick/fetch-kick-clips'

/**
 * POST /api/cron/fetch-twitch-clips
 *
 * Adaptive cron: fetches Twitch + Kick clips for active streamers.
 * The cron runs every 5 minutes, but each streamer is only fetched
 * when their individual fetch_interval_minutes has elapsed.
 *
 * Auth: x-api-key header = CRON_SECRET env var
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

    // Fetch Twitch clips
    const twitchResult = await fetchAndScoreStreamerClips(admin, 48, 20)

    // Fetch Kick clips (resilient — if Kick fails, we still return Twitch results)
    let kickResult = { upserted: 0, snapshots: 0, streamers_scanned: 0, errors: [] as string[] }
    try {
      kickResult = await fetchAndScoreKickClips(admin, 20)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      kickResult.errors.push(`Kick pipeline: ${msg}`)
    }

    // Cleanup old snapshots
    let cleaned = 0
    try {
      cleaned = await cleanupOldSnapshots(admin, 7)
    } catch { /* non-fatal */ }

    const totalUpserted = twitchResult.upserted + kickResult.upserted
    const totalStreamers = twitchResult.streamers_scanned + kickResult.streamers_scanned
    const totalSnapshots = twitchResult.snapshots + kickResult.snapshots
    const allErrors = [...twitchResult.errors, ...kickResult.errors]

    return NextResponse.json({
      data: {
        upserted: totalUpserted,
        snapshots: totalSnapshots,
        streamers_scanned: totalStreamers,
        snapshots_cleaned: cleaned,
        twitch: twitchResult,
        kick: kickResult,
        errors: allErrors,
      },
      error: null,
      message: `${totalUpserted} clips imported · ${totalStreamers} streamers · ${totalSnapshots} snapshots`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'API key missing (use ?key=...)' },
      { status: 401 }
    )
  }
  const headers = new Headers(req.headers)
  headers.set('x-api-key', key)
  const patchedReq = new NextRequest(req.url, {
    method: 'POST',
    headers,
  })
  return POST(patchedReq)
}
