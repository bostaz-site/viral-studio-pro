import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { resolveEffectivePlan, getPlanConfig } from '@/lib/plans'

/**
 * POST /api/upload/sign
 *
 * Returns a signed Supabase Storage upload URL so the client can upload
 * directly to storage (bypasses Netlify's 6 MB function payload limit).
 *
 * Works for both authenticated and anonymous users.
 * Also pre-creates the `videos` row so the client can redirect to the editor.
 *
 * Supports retry: if `existingVideoId` is passed, reuses that record
 * instead of creating a new one (prevents orphans on retry).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`upload-sign:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: 'Too many requests. Try again shortly.' },
      { status: 429 },
    )
  }

  let userId: string | null = null
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* anonymous */ }

  let body: { filename?: string; contentType?: string; fileSize?: number; existingVideoId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid request body', message: 'Expected JSON with filename, contentType, fileSize' },
      { status: 400 },
    )
  }

  const { filename, contentType, fileSize, existingVideoId } = body

  if (!filename || typeof filename !== 'string') {
    return NextResponse.json(
      { data: null, error: 'Missing filename', message: 'filename is required' },
      { status: 400 },
    )
  }

  // Resolve plan-based upload limit
  let maxUploadMB = 200 // default for anonymous / free
  if (userId) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, is_comp')
      .eq('id', userId)
      .single()
    const plan = resolveEffectivePlan(profile as { plan: string | null; is_comp: boolean | null } | null)
    maxUploadMB = getPlanConfig(plan).limits.maxUploadSizeMB
  }
  const maxFileSize = maxUploadMB * 1024 * 1024

  if (fileSize && fileSize > maxFileSize) {
    return NextResponse.json(
      {
        data: null,
        error: 'File too large',
        message: `Maximum file size is ${maxUploadMB} MB on your plan. Upgrade for larger uploads.`,
      },
      { status: 400 },
    )
  }

  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/avi', 'video/webm']
  const mime = contentType || 'video/mp4'
  if (!allowedTypes.includes(mime) && !filename.match(/\.(mp4|mov|mkv|avi|webm)$/i)) {
    return NextResponse.json(
      { data: null, error: 'Invalid file type', message: 'Only MP4, MOV, MKV, AVI, WebM allowed' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

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

  // Retry path: reuse existing video record if provided
  if (existingVideoId) {
    const { data: existing } = await admin
      .from('videos')
      .select('id')
      .eq('id', existingVideoId)
      .maybeSingle()

    if (existing) {
      // Update the storage path for the retry
      await admin
        .from('videos')
        .update({ storage_path: storagePath, status: 'uploading', error_message: null })
        .eq('id', existingVideoId)

      return NextResponse.json({
        data: {
          signedUrl: signed.signedUrl,
          token: signed.token,
          path: signed.path,
          storagePath,
          videoId: existingVideoId,
        },
        error: null,
        message: 'Signed URL created (retry — reusing video record)',
      })
    }
  }

  // New upload: pre-create video record
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  const { data: video, error: dbError } = await admin
    .from('videos')
    .insert({
      user_id: userId,
      title,
      storage_path: storagePath,
      mime_type: mime,
      file_size_bytes: fileSize ?? 0,
      status: 'uploading',
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

/**
 * DELETE /api/upload/sign?videoId=xxx
 *
 * Cleans up an orphaned video record when the user abandons an upload.
 */
export async function DELETE(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Only delete if status is still 'uploaded' (not yet processed)
  const { data } = await admin
    .from('videos')
    .select('id, storage_path, status')
    .eq('id', videoId)
    .eq('status', 'uploaded')
    .maybeSingle()

  if (data) {
    // Clean up storage file if it exists
    if (data.storage_path) {
      await admin.storage.from('videos').remove([data.storage_path])
    }
    await admin.from('videos').delete().eq('id', data.id)
  }

  return NextResponse.json({ ok: true })
}
