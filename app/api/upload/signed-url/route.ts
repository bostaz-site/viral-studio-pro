import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

/**
 * POST /api/upload/signed-url
 *
 * Returns a Supabase Storage signed upload URL so the browser can upload
 * directly to storage, bypassing the Netlify Functions body limit.
 */

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
]

const MAX_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json() as { fileName?: string; fileSize?: number; mimeType?: string }
    const { fileName, fileSize, mimeType } = body

    if (!fileName || !fileSize || !mimeType) {
      return NextResponse.json(
        { data: null, error: 'Missing fields', message: 'fileName, fileSize, and mimeType are required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { data: null, error: 'Invalid file type', message: 'Only MP4, MOV, MKV, AVI files are allowed' },
        { status: 400 }
      )
    }

    if (fileSize > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { data: null, error: 'File too large', message: 'La taille max est 500 MB' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const videoId = crypto.randomUUID()
    const ext = fileName.split('.').pop() ?? 'mp4'
    const storagePath = `${user.id}/${videoId}/source.${ext}`

    const { data: signedData, error: signedError } = await admin.storage
      .from('videos')
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedData) {
      return NextResponse.json(
        { data: null, error: signedError?.message ?? 'Failed to create upload URL', message: 'Erreur lors de la création de l\'URL d\'upload' },
        { status: 500 }
      )
    }

    const { error: dbError } = await admin
      .from('videos')
      .insert({
        id: videoId,
        user_id: user.id,
        title: fileName.replace(/\.[^/.]+$/, ''),
        storage_path: storagePath,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        source_platform: 'upload',
        status: 'uploaded',
      })

    if (dbError) {
      return NextResponse.json(
        { data: null, error: dbError.message, message: 'Failed to save video metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        video_id: videoId,
        signed_url: signedData.signedUrl,
        token: signedData.token,
        storage_path: storagePath,
      },
      error: null,
      message: 'Signed URL created',
    })
  } catch (error) {
    console.error('[upload/signed-url] Error:', error)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
})
