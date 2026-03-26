import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const videoId = req.nextUrl.searchParams.get('video_id')
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!videoId || !UUID_RE.test(videoId)) {
    return NextResponse.json({ data: null, error: 'Missing or invalid video_id', message: 'video_id UUID requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: video } = await admin
    .from('videos')
    .select('storage_path')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video?.storage_path) {
    return NextResponse.json({ data: null, error: 'Video not found', message: 'Vidéo introuvable' }, { status: 404 })
  }

  const { data: signed } = await admin.storage
    .from('videos')
    .createSignedUrl(video.storage_path, 3600)

  if (!signed?.signedUrl) {
    return NextResponse.json({ data: null, error: 'Failed to generate URL', message: 'URL impossible à générer' }, { status: 500 })
  }

  return NextResponse.json({ data: { url: signed.signedUrl }, error: null, message: 'OK' })
}
