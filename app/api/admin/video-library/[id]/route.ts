import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedUrl } from '@/lib/admin/video-library/upload'

function extractId(req: NextRequest): string {
  return req.nextUrl.pathname.split('/').at(-1) || ''
}

// GET /api/admin/video-library/[id] — video detail with signed URLs + assets + performance
export const GET = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  const admin = createAdminClient()

  const { data: video, error } = await admin
    .from('promo_videos')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !video) {
    return NextResponse.json({ data: null, error: 'Video not found' }, { status: 404 })
  }

  // Get signed URLs
  const videoUrl = await getSignedUrl(video.storage_path, 3600).catch(() => null)
  const thumbnailUrl = video.thumbnail_path
    ? await getSignedUrl(video.thumbnail_path, 3600).catch(() => null)
    : null

  // Get assets
  const { data: assets } = await admin
    .from('promo_video_assets')
    .select('*')
    .eq('promo_video_id', id)

  // Get recent performance (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: performance } = await admin
    .from('promo_video_performance_daily')
    .select('*')
    .eq('promo_video_id', id)
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: true })

  return NextResponse.json({
    data: {
      ...video,
      video_signed_url: videoUrl,
      thumbnail_signed_url: thumbnailUrl,
      assets: assets || [],
      performance: performance || [],
    },
    error: null,
  })
})

// PUT /api/admin/video-library/[id] — update video metadata/tags
export const PUT = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  const body = await req.json()

  const allowedFields = [
    'title', 'description', 'niche', 'hook_type', 'tone', 'language',
    'status', 'thumbnail_path', 'duration_seconds', 'width', 'height',
    'aspect_ratio', 'codec', 'file_size_bytes',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: null, error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('promo_videos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null })
})

// DELETE /api/admin/video-library/[id] — archive (soft delete)
export const DELETE = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  const admin = createAdminClient()

  const { error } = await admin
    .from('promo_videos')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { archived: true }, error: null })
})
