import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

// POST /api/upload — Upload a video file to Supabase Storage + create video record
export const POST = withAuth(async (request, user) => {
  const admin = createAdminClient()

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid form data', message: 'Could not parse upload' },
      { status: 400 }
    )
  }

  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string) || 'Untitled clip'

  if (!file) {
    return NextResponse.json(
      { data: null, error: 'No file provided', message: 'Please select a video file' },
      { status: 400 }
    )
  }

  // Validate file type
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/avi', 'video/webm']
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|mkv|avi|webm)$/i)) {
    return NextResponse.json(
      { data: null, error: 'Invalid file type', message: 'Only MP4, MOV, MKV, AVI, WebM files are allowed' },
      { status: 400 }
    )
  }

  // Validate file size (500 MB max)
  const maxSize = 500 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json(
      { data: null, error: 'File too large', message: 'Maximum file size is 500 MB' },
      { status: 400 }
    )
  }

  // Generate unique storage path
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const timestamp = Date.now()
  const storagePath = `${user.id}/${timestamp}.${ext}`

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('videos')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'video/mp4',
      upsert: false,
    })

  if (uploadError) {
    console.error('[upload] Storage error:', uploadError)
    return NextResponse.json(
      { data: null, error: uploadError.message, message: 'Failed to upload video' },
      { status: 500 }
    )
  }

  // Create video record in database
  const { data: video, error: videoError } = await admin
    .from('videos')
    .insert({
      user_id: user.id,
      title,
      storage_path: storagePath,
      mime_type: file.type || 'video/mp4',
      file_size_bytes: file.size,
      status: 'uploaded',
    })
    .select('id, title, storage_path, status, created_at')
    .single()

  if (videoError) {
    console.error('[upload] DB error:', videoError)
    // Try to clean up the uploaded file
    await admin.storage.from('videos').remove([storagePath])
    return NextResponse.json(
      { data: null, error: videoError.message, message: 'Failed to create video record' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      data: video,
      error: null,
      message: 'Video uploaded successfully',
    },
    { status: 201 }
  )
})
