import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
]

const MAX_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB

export const POST = withAuth(async (request, user) => {
  try {
    const admin = createAdminClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { data: null, error: 'No file provided', message: 'No file provided' },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { data: null, error: 'Invalid file type', message: 'Only MP4, MOV, MKV, AVI files are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { data: null, error: 'File too large', message: 'La taille max est 500 MB' },
        { status: 400 }
      )
    }

    const videoId = crypto.randomUUID()
    const ext = file.name.split('.').pop() ?? 'mp4'
    const storagePath = `${user.id}/${videoId}/source.${ext}`

    const { error: storageError } = await admin.storage
      .from('videos')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (storageError) {
      return NextResponse.json(
        { data: null, error: storageError.message, message: 'Failed to upload video to storage' },
        { status: 500 }
      )
    }

    const { data: video, error: dbError } = await admin
      .from('videos')
      .insert({
        id: videoId,
        user_id: user.id,
        title: file.name.replace(/\.[^/.]+$/, ''),
        storage_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        source_platform: 'upload',
        status: 'uploaded',
      })
      .select()
      .single()

    if (dbError) {
      await admin.storage.from('videos').remove([storagePath])
      return NextResponse.json(
        { data: null, error: dbError.message, message: 'Failed to save video metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { video_id: video.id, storage_path: storagePath },
      error: null,
      message: 'Video uploaded successfully',
    })
  } catch (error) {
    console.error('[upload] Error:', error)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
})
