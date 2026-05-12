import { NextRequest, NextResponse } from 'next/server'
import { timingSafeCompare } from '@/lib/crypto'
import { syncInstantlyStats } from '@/lib/integrations/instantly/sync'
import { logger } from '@/lib/logger'

/**
 * POST /api/cron/sync-instantly
 *
 * Scheduled sync of Instantly data (mailboxes + campaigns).
 * Runs every 15 minutes via Netlify Scheduled Functions or external cron.
 *
 * Auth: x-api-key header = CRON_SECRET
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

  if (!process.env.INSTANTLY_API_KEY) {
    logger.warn('INSTANTLY_API_KEY not set, skipping sync')
    return NextResponse.json(
      { data: null, error: null, message: 'Instantly API key not configured, skipping' },
      { status: 200 }
    )
  }

  try {
    const result = await syncInstantlyStats()

    return NextResponse.json(
      { data: result, error: null, message: 'ok' },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    logger.error({ error: message }, 'Instantly cron sync failed')

    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}
