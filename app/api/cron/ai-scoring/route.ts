import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { processAiScoringBatch } from '@/lib/admin/ai-scoring/batch-processor'

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// POST /api/cron/ai-scoring — hourly cron, scores top 3% leads via Claude
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const apiKey = req.headers.get('x-api-key') ?? ''
  if (!apiKey || !timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ data: { skipped: true, reason: 'ANTHROPIC_API_KEY not set' }, error: null, message: 'ok' })
  }

  try {
    const result = await processAiScoringBatch()
    return NextResponse.json({
      data: result,
      error: null,
      message: `Processed ${result.processed} leads (${result.failed} failed). Cost: $${result.totalCostUsd.toFixed(4)}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Cron AI Scoring]', message)
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}
