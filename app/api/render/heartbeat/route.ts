import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { redis } from '@/lib/upstash'
import { timingSafeCompare } from '@/lib/crypto'

/**
 * POST /api/render/heartbeat
 *
 * Called by VPS every 60s during a render to prevent the Redis TTL from
 * expiring on long renders (>10min). Resets the `render:active` TTL to 600s
 * and sets a per-job heartbeat key with a 120s TTL.
 *
 * Auth: VPS_RENDER_API_KEY via x-api-key header.
 *
 * VPS integration (document in VPS README):
 *   During render, send POST /api/render/heartbeat { "jobId": "..." }
 *   every 60s with header x-api-key: <VPS_RENDER_API_KEY>.
 */

const heartbeatSchema = z.object({
  jobId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!apiKey || !vpsKey || !timingSafeCompare(apiKey, vpsKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof heartbeatSchema>
  try {
    body = heartbeatSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify job exists and is actively rendering
  const { data: job } = await admin
    .from('render_jobs')
    .select('id, status')
    .eq('id', body.jobId)
    .single()

  if (!job || job.status !== 'rendering') {
    return NextResponse.json(
      { error: 'Job not found or not rendering' },
      { status: 404 },
    )
  }

  // Renew TTLs to prevent premature slot expiry
  await Promise.all([
    redis.expire(`render:started:${body.jobId}`, 900),
    redis.set(`render:heartbeat:${body.jobId}`, '1', { ex: 120 }),
  ])

  return NextResponse.json({ data: { renewed: true }, error: null })
}
