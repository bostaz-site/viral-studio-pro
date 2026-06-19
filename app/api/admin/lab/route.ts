import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const status = req.nextUrl.searchParams.get('status') || 'completed'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 50)

  // Fetch dives
  let query = admin
    .from('lab_deep_dives')
    .select('id, feature_area, cycle_number, status, confidence, estimated_effort_hours, kill_switch_severity, kill_switch_scenario, target_metric, metric_clarity_score, final_recommendation, total_cost_usd, total_duration_seconds, user_action, created_at, deliverable_completed_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') query = query.eq('status', status)

  const { data: dives, error } = await query
  if (error) return errorResponse(error.message, 500)

  // Fetch queue
  const { data: queue } = await admin
    .from('lab_queue')
    .select('*')
    .eq('active', true)
    .order('forced_next', { ascending: false })
    .order('priority', { ascending: false })
    .order('next_scheduled_at', { ascending: true })

  // Stats
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthDives } = await admin
    .from('lab_deep_dives')
    .select('total_cost_usd, confidence, status')
    .gte('created_at', startOfMonth.toISOString())

  const monthStats = {
    totalDives: (monthDives ?? []).length,
    completedDives: (monthDives ?? []).filter((d: { status: string }) => d.status === 'completed').length,
    totalCost: (monthDives ?? []).reduce((s: number, d: { total_cost_usd: number | null }) => s + (d.total_cost_usd ?? 0), 0),
    avgConfidence: (monthDives ?? []).filter((d: { confidence?: number }) => d.confidence).length > 0
      ? (monthDives ?? []).reduce((s: number, d: { confidence?: number }) => s + (d.confidence ?? 0), 0) /
        (monthDives ?? []).filter((d: { confidence?: number }) => d.confidence).length
      : 0,
  }

  return jsonResponse({ dives, queue, monthStats })
})

export const PATCH = withAdmin(async (req: NextRequest) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const body = await req.json()

  // Update dive action (accept/later/discard)
  if (body.diveId && body.action) {
    const validActions = ['accepted', 'later', 'discarded']
    if (!validActions.includes(body.action)) return errorResponse('Invalid action', 400)

    const updates: Record<string, unknown> = {
      user_action: body.action,
      user_action_at: new Date().toISOString(),
    }
    if (body.action === 'discarded') updates.status = 'discarded'

    await admin.from('lab_deep_dives').update(updates).eq('id', body.diveId)
    return jsonResponse({ updated: true })
  }

  // Force-queue a feature
  if (body.forceArea) {
    await admin
      .from('lab_queue')
      .update({ forced_next: true, next_scheduled_at: new Date().toISOString() })
      .eq('feature_area', body.forceArea)
    return jsonResponse({ forced: true })
  }

  return errorResponse('Invalid request', 400)
})

export const POST = withAdmin(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Check no cycle already in progress
  const { data: running } = await admin
    .from('lab_deep_dives')
    .select('id, feature_area')
    .eq('status', 'running')
    .limit(1)

  if (running && running.length > 0) {
    return errorResponse(`Cycle already in progress (${running[0].feature_area})`, 409)
  }

  // Check if Railway trigger URL is configured
  const triggerUrl = process.env.RAILWAY_LAB_TRIGGER_URL
  if (triggerUrl) {
    // Trigger Railway job
    await fetch(`${triggerUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.RAILWAY_LAB_API_KEY ?? '',
      },
      body: JSON.stringify({ command: 'lab:chain' }),
    }).catch(err => {
      console.error('[lab:api] Railway trigger failed:', err)
    })
    return jsonResponse({ started: true, via: 'railway' })
  }

  // No Railway — return instructions for manual trigger
  return jsonResponse({
    started: false,
    message: 'Run manually: npx tsx scripts/lab/run-deep-dive.ts --chain',
    via: 'manual',
  })
})
