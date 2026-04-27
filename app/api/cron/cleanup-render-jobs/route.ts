import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { redis } from '@/lib/upstash'
import { releaseJob, processNextInQueue } from '@/lib/render-queue'

/**
 * POST /api/cron/cleanup-render-jobs
 *
 * Cron qui tourne toutes les 5 minutes (via Netlify Scheduled Functions).
 * Marque comme 'error' les render_jobs qui sont stuck en 'pending' ou 'rendering'
 * depuis plus de 10 minutes — ce sont des jobs zombies (VPS crash, network failure).
 *
 * Rembourse le quota de l'utilisateur pour les jobs zombies.
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

  const admin = createAdminClient()
  const PENDING_TIMEOUT_MIN = 10
  const RENDERING_HARD_TIMEOUT_MIN = 15

  try {
    const pendingCutoff = new Date(Date.now() - PENDING_TIMEOUT_MIN * 60 * 1000).toISOString()
    const renderCutoff = new Date(Date.now() - RENDERING_HARD_TIMEOUT_MIN * 60 * 1000).toISOString()

    // Find zombie pending/queued jobs (>10 min since created_at)
    const { data: pendingZombies } = await admin
      .from('render_jobs')
      .select('id, user_id, status, created_at')
      .in('status', ['pending', 'queued'])
      .lt('created_at', pendingCutoff)
      .limit(25)

    // Find zombie rendering jobs (>15 min since updated_at — independent of heartbeat)
    const { data: renderingZombies } = await admin
      .from('render_jobs')
      .select('id, user_id, status, created_at')
      .eq('status', 'rendering')
      .lt('updated_at', renderCutoff)
      .limit(25)

    const zombies = [...(pendingZombies ?? []), ...(renderingZombies ?? [])]
    const fetchError = null

    if (fetchError) throw fetchError
    if (!zombies || zombies.length === 0) {
      return NextResponse.json({ data: { cleaned: 0, refunded: 0 }, error: null, message: 'No zombie jobs found' })
    }

    // Mark them as error
    const ids = zombies.map(j => j.id)
    const renderingIds = new Set((renderingZombies ?? []).map(j => j.id))

    // Update pending/queued zombies
    const pendingIds = ids.filter(id => !renderingIds.has(id))
    if (pendingIds.length > 0) {
      await admin.from('render_jobs').update({
        status: 'error',
        error_message: 'Job timed out — VPS did not respond within 10 minutes',
        updated_at: new Date().toISOString(),
      }).in('id', pendingIds)
    }

    // Update rendering zombies (hard 15min timeout)
    if (renderingIds.size > 0) {
      await admin.from('render_jobs').update({
        status: 'error',
        error_message: 'Render timed out after 15 minutes',
        updated_at: new Date().toISOString(),
      }).in('id', [...renderingIds])
    }

    const updateError = null

    if (updateError) throw updateError

    // Refund quota for each affected user
    const userCounts = new Map<string, number>()
    for (const z of zombies) {
      if (z.user_id) {
        userCounts.set(z.user_id, (userCounts.get(z.user_id) ?? 0) + 1)
      }
    }

    let refunded = 0
    for (const [userId, count] of userCounts) {
      const { error: refundError } = await (admin.rpc as CallableFunction)('refund_video_usage', {
        p_user_id: userId,
        p_count: count,
      })
      if (!refundError) refunded += count
      else console.warn(`[cleanup-render-jobs] Failed to refund ${count} for user ${userId}:`, refundError)
    }

    // Free orphaned render queue slots in Redis + clean heartbeat keys
    for (const z of zombies) {
      console.log('[cleanup] Freed orphaned slot for job:', z.id)
      await releaseJob(z.id)
      redis.del(`render:heartbeat:${z.id}`).catch(() => {})
    }
    // Dispatch next queued jobs now that slots are freed
    for (let i = 0; i < zombies.length; i++) {
      const next = await processNextInQueue()
      if (!next) break
      // Fire-and-forget to VPS
      const vpsUrl = process.env.VPS_RENDER_URL
      const vpsKey = process.env.VPS_RENDER_API_KEY
      if (vpsUrl && vpsKey) {
        await admin.from('render_jobs').update({ status: 'pending' }).eq('id', next.jobId)
        fetch(`${vpsUrl}/api/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': vpsKey },
          body: JSON.stringify(next.payload),
          signal: AbortSignal.timeout(15000),
        }).catch(() => {})
      }
    }

    console.log(`[cleanup-render-jobs] Cleaned ${zombies.length} zombie jobs, refunded ${refunded} credits`)

    return NextResponse.json({
      data: { cleaned: zombies.length, refunded },
      error: null,
      message: `${zombies.length} zombie jobs cleaned, ${refunded} credits refunded`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[cleanup-render-jobs] Error:', message)
    return NextResponse.json({ data: null, error: message }, { status: 500 })
  }
}

// GET shortcut pour test manuel (comme les autres crons)
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 401 })
  const headers = new Headers(req.headers)
  headers.set('x-api-key', key)
  return POST(new NextRequest(req.url, { method: 'POST', headers }))
}
