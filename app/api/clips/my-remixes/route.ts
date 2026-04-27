import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * GET /api/clips/my-remixes
 * Returns render_jobs for the current user, joined with trending_clips metadata.
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  const rl = await rateLimit(`data:${user.id}`, RATE_LIMITS.data.limit, RATE_LIMITS.data.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  const admin = createAdminClient()
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '20'), 50)
  const offset = Math.max(Number(request.nextUrl.searchParams.get('offset') ?? '0'), 0)

  // Fetch render jobs
  const { data: jobs, error, count } = await admin
    .from('render_jobs')
    .select('id, clip_id, source, status, storage_path, error_message, created_at, updated_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Failed to fetch remixes' },
      { status: 500 }
    )
  }

  // Fetch trending clip metadata for each job
  const clipIds = [...new Set((jobs ?? []).map(j => j.clip_id).filter(Boolean))]
  const clipMap = new Map<string, {
    title: string | null
    thumbnail_url: string | null
    platform: string
    velocity_score: number | null
    author_handle: string | null
  }>()

  if (clipIds.length > 0) {
    const { data: clips } = await admin
      .from('trending_clips')
      .select('id, title, thumbnail_url, platform, velocity_score, author_handle')
      .in('id', clipIds)

    if (clips) {
      for (const c of clips) {
        clipMap.set(c.id, {
          title: c.title,
          thumbnail_url: c.thumbnail_url,
          platform: c.platform,
          velocity_score: c.velocity_score,
          author_handle: c.author_handle,
        })
      }
    }
  }

  // Generate signed download URLs for completed jobs
  const enrichedJobs = await Promise.all((jobs ?? []).map(async (job) => {
    let downloadUrl: string | null = null
    if (job.status === 'done' && job.storage_path) {
      const { data: signedData } = await admin.storage
        .from('clips')
        .createSignedUrl(job.storage_path, 14400) // 4 hours
      downloadUrl = signedData?.signedUrl ?? null
    }

    const canDownload = job.status === 'done' && !!job.storage_path && !!downloadUrl

    return {
      ...job,
      downloadUrl,
      can_download: canDownload,
      clip: clipMap.get(job.clip_id) ?? null,
    }
  }))

  return NextResponse.json({
    data: enrichedJobs,
    error: null,
    message: 'OK',
    meta: { total: count ?? 0, limit, offset },
  })
})
