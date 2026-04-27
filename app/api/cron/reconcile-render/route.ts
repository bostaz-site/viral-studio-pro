import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { redis } from '@/lib/upstash'
import { releaseJob, processNextInQueue } from '@/lib/render-queue'

/**
 * POST /api/cron/reconcile-render
 *
 * Runs every 30 minutes. Synchronizes the Redis active jobs Set with DB state.
 * Removes stale entries (jobs that finished/errored/vanished) and dispatches
 * queued jobs into freed slots.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret || !timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  let freed = 0

  // 1. Get all job IDs from Redis Set
  const activeJobIds = await redis.smembers<string[]>('render:active_jobs')

  // 2. For each, check DB status
  if (activeJobIds.length > 0) {
    for (const jobId of activeJobIds) {
      const { data: job } = await admin
        .from('render_jobs')
        .select('id, status')
        .eq('id', jobId)
        .single()

      // Job doesn't exist or is in a terminal state → remove from Set
      if (!job || ['done', 'error', 'failed', 'cancelled', 'expired'].includes(job.status)) {
        await releaseJob(jobId)
        freed++
        console.log(`[reconcile] Removed stale job ${jobId} (status: ${job?.status ?? 'missing'})`)
      }
    }
  }

  // 3. Check for stuck "queued" jobs that have been waiting > 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: stuckQueued } = await admin
    .from('render_jobs')
    .select('id')
    .eq('status', 'queued')
    .lt('updated_at', thirtyMinAgo)
    .limit(10)

  if (stuckQueued?.length) {
    for (const job of stuckQueued) {
      await admin.from('render_jobs').update({
        status: 'error',
        error_message: 'Stuck in queue > 30min — auto-cancelled by reconciler',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
    }
    console.log(`[reconcile] Cancelled ${stuckQueued.length} stuck queued jobs`)
  }

  // 4. After cleanup, dispatch any queued jobs into freed slots
  let dispatched = 0
  if (freed > 0) {
    for (let i = 0; i < freed; i++) {
      const next = await processNextInQueue()
      if (!next) break
      dispatched++
    }
  }

  // 5. Log summary
  const finalCount = await redis.scard('render:active_jobs')
  console.log(`[reconcile] Active jobs after cleanup: ${finalCount} (freed ${freed}, dispatched ${dispatched})`)

  return NextResponse.json({
    data: { freed, dispatched, stuckCancelled: stuckQueued?.length ?? 0, activeAfter: finalCount },
    error: null,
  })
}
