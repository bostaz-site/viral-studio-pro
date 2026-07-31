import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/upload/complete
 *
 * Step 3 of the signed-upload flow.
 * Verifies the file actually landed in Storage, then flips status to 'uploaded'.
 */
export async function POST(req: NextRequest) {
  let userId: string | null = null
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* anonymous */ }

  let body: { videoId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid request body', message: 'Expected JSON with videoId' },
      { status: 400 },
    )
  }

  const { videoId } = body
  if (!videoId || typeof videoId !== 'string') {
    return NextResponse.json(
      { data: null, error: 'Missing videoId', message: 'videoId is required' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Fetch the video record
  const { data: video, error: fetchError } = await admin
    .from('videos')
    .select('id, storage_path, user_id, status, title, created_at')
    .eq('id', videoId)
    .maybeSingle()

  if (fetchError || !video) {
    return NextResponse.json(
      { data: null, error: 'Video not found', message: 'No video record for this ID' },
      { status: 404 },
    )
  }

  // Ownership check — auth required, no anonymous completion
  if (!userId || (video.user_id && video.user_id !== userId)) {
    return NextResponse.json(
      { data: null, error: 'Forbidden', message: 'You do not own this video' },
      { status: 403 },
    )
  }

  // Already completed — idempotent
  if (video.status === 'uploaded') {
    return NextResponse.json({
      data: { id: video.id, title: video.title, storage_path: video.storage_path, status: video.status, created_at: video.created_at },
      error: null,
      message: 'Already completed',
    })
  }

  // Verify file exists in storage
  if (video.storage_path) {
    const pathParts = video.storage_path.split('/')
    const folder = pathParts.slice(0, -1).join('/')
    const filename = pathParts[pathParts.length - 1]

    const { data: files } = await admin.storage
      .from('videos')
      .list(folder, { limit: 100, search: filename })

    const found = files?.some(f => f.name === filename)
    if (!found) {
      return NextResponse.json(
        { data: null, error: 'File not found in storage', message: 'The upload did not complete — please retry' },
        { status: 400 },
      )
    }
  }

  // Update status
  const { data: updated, error: updateError } = await admin
    .from('videos')
    .update({ status: 'uploaded' })
    .eq('id', videoId)
    .select('id, title, storage_path, status, created_at')
    .single()

  if (updateError) {
    return NextResponse.json(
      { data: null, error: updateError.message, message: 'Failed to update video status' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: updated,
    error: null,
    message: 'Upload complete',
  })
}
