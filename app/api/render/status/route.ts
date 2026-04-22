import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

interface RenderJob {
  id: string
  status: string
  storage_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export const GET = withAuth(async (request: NextRequest, user) => {
  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { data: null, error: 'Missing jobId', message: 'jobId requis' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job, error } = await (admin as any)
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

  // If done, generate a signed URL for download AND a public URL for preview
  let downloadUrl: string | null = null
  let publicUrl: string | null = null
  let thumbnailUrl: string | null = null
  if (job.status === 'done' && job.storage_path) {
    const { data: signedData } = await admin.storage
      .from('clips')
      .createSignedUrl(job.storage_path, 3600) // 1 hour expiry

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
