import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { releaseJob, processNextInQueue } from '@/lib/render-queue'
import { redis } from '@/lib/upstash'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface RenderJob {
  id: string
  clip_id: string
  source: string
  status: string
  storage_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export const GET = withAuth(async (request: NextRequest, user) => {
  const rl = await rateLimit(`status:${user.id}`, RATE_LIMITS.status.limit, RATE_LIMITS.status.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { data: null, error: 'Missing jobId', message: 'jobId requis' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data: job, error } = await admin
    .from('render_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single() as { data: RenderJob | null; error: unknown }

  if (error || !job) {
    return NextResponse.json(
      { data: null, error: 'Job not found', message: 'Job introuvable' },
      { status: 404 }
    )
  }

  // If the job is still pending/rendering, ask the VPS queue where it sits.
  // 0 = "your turn, running right now", N = N-th in line, -1 = unknown.
  let queuePosition: number | null = null
  if (job.status === 'pending' || job.status === 'rendering') {
    try {
      const vpsUrl = process.env.VPS_RENDER_URL
      if (vpsUrl) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(
          `${vpsUrl.replace(/\/$/, '')}/api/health/queue?jobId=${encodeURIComponent(jobId)}`,
          { signal: controller.signal, cache: 'no-store' },
        )
        clearTimeout(timer)
        if (res.ok) {
          const json = (await res.json()) as { jobPosition: number | null }
          queuePosition = json.jobPosition
        }
      }
    } catch {
      // Swallow — queue position is a nice-to-have, not required for correctness.
    }
  }

  if (['done', 'error', 'failed', 'cancelled', 'expired'].includes(job.status)) {
    // Job finished — release slot (idempotent) and dispatch next queued render
    releaseJob(job.id).then(() => processNextInQueue()).catch(() => {})

    // Increment export_count on trending clip (idempotent: only once per job)
    if (job.status === 'done' && job.source === 'trending') {
      redis.set(`export_counted:${job.id}`, '1', { nx: true, ex: 86400 })
        .then(result => {
          if (result === 'OK') {
            return (admin.rpc as CallableFunction)('increment_export_count', { p_clip_id: job.clip_id })
          }
        })
        .catch(() => {})
    }
  }

  // If done, generate a signed URL for download AND a public URL for preview
  let downloadUrl: string | null = null
  let publicUrl: string | null = null
  let thumbnailUrl: string | null = null
  if ((job.status === 'done') && job.storage_path) {
    const { data: signedData } = await admin.storage
      .from('clips')
      .createSignedUrl(job.storage_path, 14400) // 4 hours

    downloadUrl = signedData?.signedUrl ?? null

    // Also get public URL (clips bucket is public) — used for live preview replacement
    const { data: pubData } = admin.storage
      .from('clips')
      .getPublicUrl(job.storage_path)
    publicUrl = pubData?.publicUrl ?? null

    // Get thumbnail URL (extracted from rendered output) — used as poster frame while video loads
    const thumbPath = job.storage_path.replace(/\.mp4$/, '_thumb.png')
    const { data: thumbData } = admin.storage
      .from('thumbnails')
      .getPublicUrl(thumbPath)
    thumbnailUrl = thumbData?.publicUrl ?? null
  }

  // Contextual message that reflects queue position when available
  let message: string
  if (job.status === 'done') {
    message = 'Render complete!'
  } else if (job.status === 'failed') {
    message = `Failed after retries: ${job.error_message}`
  } else if (job.status === 'cancelled') {
    message = 'Render cancelled'
  } else if (job.status === 'expired') {
    message = 'Clip expired — remix again to download'
  } else if (job.status === 'error') {
    message = `Error: ${job.error_message}`
  } else if (queuePosition !== null && queuePosition > 0) {
    message = `In queue — position ${queuePosition}`
  } else if (job.status === 'rendering') {
    message = 'Rendering...'
  } else {
    message = 'Waiting...'
  }

  return NextResponse.json({
    data: {
      jobId: job.id,
      status: job.status,
      storagePath: job.storage_path,
      downloadUrl,
      publicUrl,
      thumbnailUrl,
      errorMessage: job.error_message,
      queuePosition,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    },
    error: null,
    message,
  })
})
