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

  // If done, generate a signed URL for download AND a public URL for preview
  let downloadUrl: string | null = null
  let publicUrl: string | null = null
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
  }

  return NextResponse.json({
    data: {
      jobId: job.id,
      status: job.status,
      storagePath: job.storage_path,
      downloadUrl,
      publicUrl,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    },
    error: null,
    message: job.status === 'done' ? 'Rendu terminé !' :
             job.status === 'error' ? `Erreur : ${job.error_message}` :
             job.status === 'rendering' ? 'Rendu en cours...' :
             'En attente...',
  })
})
