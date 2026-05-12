import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { runAllChecks, type AlertCandidate } from '@/lib/admin/watchdog/checks'
import { detectAnomalies } from '@/lib/admin/watchdog/anomaly-detector'
import { notifyCriticalAlerts } from '@/lib/admin/watchdog/notifier'

/**
 * POST /api/cron/watchdog
 *
 * Runs every 15 min via external cron (cron-job.org, GitHub Actions, etc.)
 * Auth: x-api-key header = CRON_SECRET
 *
 * 1. Run all health checks (rule-based)
 * 2. Run Claude Haiku anomaly detection (weekly, cheap)
 * 3. Dedupe alerts (skip if same title exists in last 24h)
 * 4. Insert new alerts
 * 5. Email critical alerts
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const startMs = Date.now()

  try {
    // 1. Rule-based checks
    const alerts = await runAllChecks(admin)

    // 2. AI anomaly detection (only run every ~6h to save cost)
    const hour = new Date().getUTCHours()
    if (hour % 6 === 0 && new Date().getMinutes() < 15) {
      const aiAlert = await detectAnomalies(admin)
      if (aiAlert) alerts.push(aiAlert)
    }

    // 3. Dedupe: skip alerts with same title in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const deduped: AlertCandidate[] = []

    for (const alert of alerts) {
      const { count } = await admin
        .from('agent_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('title', alert.title)
        .gte('detected_at', oneDayAgo)

      if (!count || count === 0) {
        deduped.push(alert)
      }
    }

    // 4. Insert new alerts
    if (deduped.length > 0) {
      const { data: inserted } = await admin
        .from('agent_alerts')
        .insert(deduped.map(a => ({
          severity: a.severity,
          category: a.category,
          title: a.title,
          description: a.description,
          metadata: (a.metadata || {}) as Record<string, string>,
        })))
        .select('id, severity, category, title, description')

      // 5. Email critical alerts
      if (inserted && inserted.length > 0) {
        await notifyCriticalAlerts(admin, inserted)
      }
    }

    const durationMs = Date.now() - startMs

    return NextResponse.json({
      data: {
        checks_run: alerts.length + (alerts.length > 0 ? 0 : 0),
        alerts_found: alerts.length,
        alerts_deduped: alerts.length - deduped.length,
        alerts_inserted: deduped.length,
        duration_ms: durationMs,
      },
      error: null,
      message: 'ok',
    })
  } catch (err) {
    console.error('[cron/watchdog] Fatal error:', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal error', message: 'error' },
      { status: 500 }
    )
  }
}
