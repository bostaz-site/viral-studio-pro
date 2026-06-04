import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/upload/sign
 *
 * Returns a signed Supabase Storage upload URL so the client can upload
 * directly to storage (bypasses Netlify's 6 MB function payload limit).
 *
 * Works for both authenticated and anonymous users.
 * Also pre-creates the `videos` row so the client can redirect to the editor.
 */
export async function POST(req: NextRequest) {
  // Rate limit by IP (anonymous-safe)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`upload-sign:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: 'Too many requests. Try again shortly.' },
      { status: 429 },
    )
  }

  // Try to get authenticated user (optional — anonymous uploads allowed)
  let userId: string | null = null
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* anonymous */ }

  let body: { filename?: string; contentType?: string; fileSize?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid request body', message: 'Expected JSON with filename, contentType, fileSize' },
      { status: 400 },
    )
  }

  const { filename, contentType, fileSize } = body

  if (!filename || typeof filename !== 'string') {
    return NextResponse.json(
      { data: null, error: 'Missing filename', message: 'filename is required' },
      { status: 400 },
    )
  }

  // Validate file size (500 MB max)
  if (fileSize && fileSize > 500 * 1024 * 1024) {
    return NextResponse.json(
      { data: null, error: 'File too large', message: 'Maximum file size is 500 MB' },
      { status: 400 },
    )
  }

  // Validate content type
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/avi', 'video/webm']
  const mime = contentType || 'video/mp4'
  if (!allowedTypes.includes(mime) && !filename.match(/\.(mp4|mov|mkv|avi|webm)$/i)) {
    return NextResponse.json(
      { data: null, error: 'Invalid file type', message: 'Only MP4, MOV, MKV, AVI, WebM allowed' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Generate unique storage path
  const ext = filename.split('.').pop()?.toLowerCase() || 'mp4'
  const prefix = userId ?? 'anonymous'
  const storagePath = `${prefix}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`

  // Create signed upload URL (valid ~2 hours)
  const { data: signed, error: signError } = await admin.storage
    .from('videos')
    .createSignedUploadUrl(storagePath)

  if (signError || !signed) {
    return NextResponse.json(
      { data: null, error: signError?.message ?? 'Failed to create upload URL', message: 'Storage error' },
      { status: 500 },
    )
  }

  // Pre-create video record so client can redirect to editor immediately
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  const { data: video, error: dbError } = await admin
    .from('videos')
    .insert({
      user_id: userId,
      title,
      storage_path: storagePath,
      mime_type: mime,
      file_size_bytes: fileSize ?? 0,
      status: 'uploaded',
    })
    .select('id')
    .single()

  if (dbError) {
    return NextResponse.json(
      { data: null, error: dbError.message, message: 'Failed to create video record' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: {
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: signed.path,
      storagePath,
      videoId: video.id,
    },
    error: null,
    message: 'Signed URL created',
  })
}
