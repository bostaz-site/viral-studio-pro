import { NextRequest, NextResponse } from 'next/server'
import { timingSafeCompare } from '@/lib/crypto'
import { refreshExpiringTokens } from '@/lib/distribution/token-manager'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/refresh-oauth-tokens
 *
 * Proactively refreshes all OAuth tokens expiring within the next 12 hours.
 * Protects against silent autofarm/publish failures due to expired tokens.
 *
 * Schedule: every 6h via cron-job.org (POST with x-api-key header).
 * Auth: x-api-key = CRON_SECRET
 *
 * NOTE: After deploying, create the cron job at cron-job.org:
 *   URL:    https://viralanimal.com/api/cron/refresh-oauth-tokens
 *   Method: POST
 *   Header: x-api-key = <CRON_SECRET>
 *   Schedule: every 6 hours
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret || !timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const result = await refreshExpiringTokens(12)
    const durationMs = Date.now() - startTime

    logger.info(
      `[refresh-oauth-tokens] Done in ${durationMs}ms — ` +
      `${result.refreshed} refreshed, ${result.failed} failed, ${result.skipped} skipped`
    )

    // Log failed accounts explicitly for monitoring
    for (const detail of result.details) {
      if (detail.status === 'failed') {
        logger.error(
          `[refresh-oauth-tokens] FAILED: ${detail.platform} account ${detail.accountId} — ${detail.error}`
        )
      }
    }

    return NextResponse.json({
      data: {
        refreshed: result.refreshed,
        failed: result.failed,
        skipped: result.skipped,
        durationMs,
        details: result.details,
      },
      error: null,
      message:
        `Refreshed ${result.refreshed}, failed ${result.failed}, skipped ${result.skipped}. ` +
        `NOTE: Ensure cron-job.org is configured to call this endpoint every 6 hours.`,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`[refresh-oauth-tokens] Cron failed: ${errMsg}`)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
