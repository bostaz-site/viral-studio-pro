import { NextRequest, NextResponse } from 'next/server'
import { generateMorningBrief } from '@/lib/audit/morning-brief'

const CRON_SECRET = process.env.AUDIT_CRON_SECRET

export const maxDuration = 300 // 5 min

export async function POST(req: NextRequest) {
  // Auth: bearer token OR x-api-key header
  const authHeader = req.headers.get('Authorization')
  const apiKey = req.headers.get('x-api-key')
  const token = authHeader?.replace('Bearer ', '') ?? apiKey

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? 'brief'

  // This endpoint generates the morning brief from existing findings.
  // The actual agent runs happen on Railway VPS via scripts/audits/run-nightly.ts
  // (Netlify serverless has timeout constraints that make full agent runs unreliable)
  if (mode === 'brief' || mode === 'full') {
    try {
      const brief = await generateMorningBrief()
      return NextResponse.json({
        status: 'done',
        brief_length: brief.length,
        brief_preview: brief.slice(0, 500),
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'brief_failed' },
        { status: 500 }
      )
    }
  }

  if (mode === 'weekly-stats') {
    try {
      const { runWeeklyStatsDigest } = await import(
        '@/scripts/business/weekly-stats-digest'
      )
      await runWeeklyStatsDigest()
      return NextResponse.json({ status: 'done', mode: 'weekly-stats' })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'weekly_stats_failed' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
}
