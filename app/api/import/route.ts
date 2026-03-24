import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { downloadVideo, cleanupTempFile } from '@/lib/ytdlp'
import { readFileSync } from 'fs'

const bodySchema = z.object({
  url: z.string().url(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'URL invalide' }, { status: 400 })
  }

  const { url } = parsed.data
  const admin = createAdminClient()

  let localPath: string | null = null

  try {
    // Download via yt-dlp
    const result = await downloadVideo(url)
    localPath = result.localPath

    // Read file buffer
    const fileBuffer = readFileSync(localPath)

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${Date.now()}_${result.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.mp4`
    const { error: uploadError } = await admin.storage
      .from('videos')
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // Insert video record
    const videoInsert = {
      user_id: user.id,
      title: result.title,
      source_url: url,
      source_platform: result.platform,
      storage_path: storagePath,
      duration_seconds: Math.round(result.duration),
      mime_type: 'video/mp4',
      status: 'uploaded' as const,
      thumbnail_url: result.thumbnailUrl,
      author_name: result.authorName,
      author_handle: result.authorHandle,
    }

    const { data: video, error: dbError } = await admin
      .from('videos')
      .insert(videoInsert)
      .select('id')
      .single()

    if (dbError || !video) throw new Error(`DB insert failed: ${dbError?.message ?? 'unknown'}`)

    return NextResponse.json({
      data: { video_id: video.id, title: result.title, platform: result.platform },
      error: null,
      message: 'Vidéo importée avec succès',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de l\'import'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  } finally {
    if (localPath) cleanupTempFile(localPath)
  }
}
