import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const videoId = req.nextUrl.searchParams.get('video_id')
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!videoId || !UUID_RE.test(videoId)) {
    return NextResponse.json({ data: null, error: 'Missing or invalid video_id', message: 'video_id UUID requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: video, error: dbError } = await admin
    .from('videos')
    .select('id, title, status, source_platform, storage_path, duration_seconds, error_message')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (dbError || !video) {
    return NextResponse.json({ data: null, error: 'Video not found', message: 'Vidéo introuvable' }, { status: 404 })
  }

  // ── Self-heal: if video is stuck on 'clipping', check if all clips are terminal ──
  if (video.status === 'clipping') {
    const { data: clips } = await admin
      .from('clips')
      .select('status')
      .eq('video_id', videoId)

    if (clips && clips.length > 0) {
      const allTerminal = clips.every((c) => c.status === 'done' || c.status === 'error')
      if (allTerminal) {
        await admin
          .from('videos')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .eq('id', videoId)
        video.status = 'done'
      }
    }
  }

  return NextResponse.json({ data: video, error: null, message: 'OK' })
}
