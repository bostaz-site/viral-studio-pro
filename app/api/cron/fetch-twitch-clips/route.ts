import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { fetchAndScoreStreamerClips, cleanupOldSnapshots } from '@/lib/twitch/fetch-streamer-clips'
import { fetchAndScoreKickClips } from '@/lib/kick/fetch-kick-clips'
import { isAuditMode } from '@/lib/feature-flags'

/**
 * POST /api/cron/fetch-twitch-clips
 *
 * Time-budgeted cron: fetches Twitch + Kick clips for active streamers.
 * Called every 5 min by cron-job.org (POST, x-api-key, 30s timeout).
 *
 * Guarantees response < 20s via:
 * - 15s time budget (stops processing when exceeded)
 * - Max 5 streamers per invocation (4 Twitch + 1 Kick)
 * - Staggering: ORDER BY last_fetched_at NULLS FIRST ensures all streamers rotate
 *
 * Auth: x-api-key header = CRON_SECRET env var
 */
export async function POST(req: NextRequest) {
  if (isAuditMode) {
    return NextResponse.json(
      { data: null, error: 'Unavailable', message: 'This feature is temporarily unavailable' },
      { status: 403 }
    )
  }
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

    // ── Time budget orchestration ──────────────────────────────────────────
    // cron-job.org timeout = 30s. We stop processing at 15s to guarantee
    // a response well under 20s. Max 5 streamers per invocation (hard cap).
    // Staggering via ORDER BY last_fetched_at ensures all streamers rotate.
    const TIME_BUDGET_MS = 15_000
    const MAX_STREAMERS_TOTAL = 5
    const startTime = Date.now()

    // Twitch gets up to 4 slots (leaves room for at least 1 Kick)
    const twitchMax = Math.min(4, MAX_STREAMERS_TOTAL)
    const twitchResult = await fetchAndScoreStreamerClips(admin, 48, 20, {
      maxStreamers: twitchMax,
      timeBudgetStart: startTime,
      timeBudgetMs: TIME_BUDGET_MS,
    })

    // Kick gets remaining slots if time allows (min 2s remaining)
    const elapsedAfterTwitch = Date.now() - startTime
    const remainingSlots = MAX_STREAMERS_TOTAL - twitchResult.streamers_scanned
    let kickResult = { upserted: 0, snapshots: 0, streamers_scanned: 0, streamers_skipped: 0, timed_out: false, errors: [] as string[] }

    if (remainingSlots > 0 && (TIME_BUDGET_MS - elapsedAfterTwitch) > 2_000) {
      try {
        kickResult = await fetchAndScoreKickClips(admin, 20, {
          maxStreamers: remainingSlots,
          timeBudgetStart: startTime,
          timeBudgetMs: TIME_BUDGET_MS,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        kickResult.errors.push(`Kick pipeline: ${msg}`)
      }
    }

    // Cleanup old snapshots only if budget allows (>1s remaining)
    let cleaned = 0
    if ((TIME_BUDGET_MS - (Date.now() - startTime)) > 1_000) {
      try {
        cleaned = await cleanupOldSnapshots(admin, 7)
      } catch { /* non-fatal */ }
    }

    const elapsedMs = Date.now() - startTime
    const totalUpserted = twitchResult.upserted + kickResult.upserted
    const totalProcessed = twitchResult.streamers_scanned + kickResult.streamers_scanned
    const totalSkipped = twitchResult.streamers_skipped + kickResult.streamers_skipped
    const totalSnapshots = twitchResult.snapshots + kickResult.snapshots
    const allErrors = [...twitchResult.errors, ...kickResult.errors]
    const timedOut = twitchResult.timed_out || kickResult.timed_out

    return NextResponse.json({
      data: {
        processed: totalProcessed,
        skipped: totalSkipped,
        remaining: totalSkipped,
        elapsed_ms: elapsedMs,
        timed_out: timedOut,
        upserted: totalUpserted,
        snapshots: totalSnapshots,
        snapshots_cleaned: cleaned,
        twitch: twitchResult,
        kick: kickResult,
        errors: allErrors,
      },
      error: null,
      message: `${totalProcessed} streamers processed in ${elapsedMs}ms · ${totalUpserted} clips · ${timedOut ? 'budget reached' : 'complete'}`,
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
  if (isAuditMode) {
    return NextResponse.json(
      { data: null, error: 'Unavailable', message: 'This feature is temporarily unavailable' },
      { status: 403 }
    )
  }
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
