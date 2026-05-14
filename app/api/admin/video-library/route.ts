import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedUrl } from '@/lib/admin/video-library/upload'
import type { User } from '@supabase/supabase-js'

// GET /api/admin/video-library — list promo videos with filters
export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const url = req.nextUrl
  const status = url.searchParams.get('status') || 'active'
  const niche = url.searchParams.get('niche')
  const hookType = url.searchParams.get('hook_type')
  const search = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 24
  const offset = (page - 1) * limit

  let query = admin
    .from('promo_videos')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }
  if (niche) {
    query = query.contains('niche', [niche])
  }
  if (hookType) {
    query = query.eq('hook_type', hookType)
  }
  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data: videos, error } = await query

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  // Generate signed thumbnail URLs
  const enriched = await Promise.all(
    (videos || []).map(async (v) => ({
      ...v,
      thumbnail_signed_url: v.thumbnail_path
        ? await getSignedUrl(v.thumbnail_path, 3600).catch(() => null)
        : null,
    }))
  )

  // Summary counts
  const { count: activeCount } = await admin
    .from('promo_videos').select('id', { count: 'exact', head: true }).eq('status', 'active')
  const { count: totalCount } = await admin
    .from('promo_videos').select('id', { count: 'exact', head: true })

  return NextResponse.json({
    data: {
      videos: enriched,
      counts: { active: activeCount || 0, total: totalCount || 0 },
      page,
    },
    error: null,
  })
})

// POST /api/admin/video-library — create promo video record after upload
export const POST = withAdmin(async (req: NextRequest, user: User) => {
  try {
    const body = await req.json()
    const {
      title, description, storage_path, thumbnail_path,
      duration_seconds, width, height, aspect_ratio, codec, file_size_bytes,
      niche, hook_type, tone, language,
    } = body

    if (!title || !storage_path) {
      return NextResponse.json({ data: null, error: 'title and storage_path required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: video, error } = await admin
      .from('promo_videos')
      .insert({
        title,
        description: description || null,
        storage_path,
        thumbnail_path: thumbnail_path || null,
        duration_seconds: duration_seconds || null,
        width: width || null,
        height: height || null,
        aspect_ratio: aspect_ratio || null,
        codec: codec || null,
        file_size_bytes: file_size_bytes || null,
        niche: niche || [],
        hook_type: hook_type || null,
        tone: tone || null,
        language: language || 'en',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: video, error: null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create video'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
})
