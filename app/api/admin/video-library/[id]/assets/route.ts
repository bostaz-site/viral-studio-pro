import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedUrl } from '@/lib/admin/video-library/upload'

function extractVideoId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 2]
}

// GET /api/admin/video-library/[id]/assets — list assets with signed URLs
export const GET = withAdmin(async (req: NextRequest) => {
  const videoId = extractVideoId(req)
  const admin = createAdminClient()

  const { data: assets, error } = await admin
    .from('promo_video_assets')
    .select('*')
    .eq('promo_video_id', videoId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  const enriched = await Promise.all(
    (assets || []).map(async (a) => ({
      ...a,
      signed_url: await getSignedUrl(a.storage_path, 3600).catch(() => null),
    }))
  )

  return NextResponse.json({ data: enriched, error: null })
})

// POST /api/admin/video-library/[id]/assets — add an asset
export const POST = withAdmin(async (req: NextRequest) => {
  const videoId = extractVideoId(req)
  const body = await req.json()
  const { asset_type, storage_path, file_size_bytes } = body

  if (!asset_type || !storage_path) {
    return NextResponse.json({ data: null, error: 'asset_type and storage_path required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('promo_video_assets')
    .insert({
      promo_video_id: videoId,
      asset_type,
      storage_path,
      file_size_bytes: file_size_bytes || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null })
})
