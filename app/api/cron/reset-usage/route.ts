import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'

/**
 * POST /api/cron/reset-usage
 *
 * Resets monthly_videos_used and monthly_processing_minutes_used for all users.
 * Should be called on the 1st of each month by:
 *   - n8n cron workflow, OR
 *   - Netlify scheduled function, OR
 *   - External cron (cron-job.org, GitHub Actions, etc.)
 *
 * Auth: x-api-key header = CRON_SECRET env var (dedicated, NOT shared with N8N_API_KEY)
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

  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Invalid API key' },
      { status: 401 }
    )
  }

  try {
    const admin = createAdminClient()

    // Reset all usage counters
    const { error, count } = await admin
      .from('profiles')
      .update({
        monthly_videos_used: 0,
        monthly_processing_minutes_used: 0,
        updated_at: new Date().toISOString(),
      })
      .gte('monthly_videos_used', 0) // Match all rows (workaround: Supabase requires a filter)

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message, message: 'Failed to reset usage' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { reset_count: count ?? 0, reset_at: new Date().toISOString() },
      error: null,
      message: `Usage counters reset for ${count ?? 0} users`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}
