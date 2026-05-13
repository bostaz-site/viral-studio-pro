import { NextRequest, NextResponse } from 'next/server'
import { timingSafeCompare } from '@/lib/crypto'
import { processMonthlyPayouts } from '@/lib/admin/stripe/payouts'

/**
 * POST /api/cron/monthly-payouts
 *
 * Monthly payout processing for all eligible affiliates.
 * Runs on the 1st of each month at 9 AM via Netlify Scheduled Functions.
 *
 * Auth: x-api-key header = CRON_SECRET
 *
 * Flow:
 * 1. Find all affiliates with active Connect accounts
 * 2. Calculate payable balance (ledger - holds)
 * 3. Run fraud checks (skip critical flags, recent chargebacks, < 2 cycles)
 * 4. First payout or > $500 = manual review required
 * 5. Auto-approved payouts execute Stripe Transfer immediately
 * 6. Manual review payouts wait for admin approval
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'API key missing' },
      { status: 401 },
    )
  }

  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Invalid API key' },
      { status: 401 },
    )
  }

  try {
    const result = await processMonthlyPayouts()

    return NextResponse.json({
      data: result,
      error: null,
      message: `Payouts processed: ${result.processed} sent, ${result.needsReview} needs review, ${result.skipped} skipped, ${result.errors.length} errors`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
