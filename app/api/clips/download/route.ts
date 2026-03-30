import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/clips/download?clip_id=xxx&format=9:16
 *
 * Returns a redirect to a signed Supabase Storage URL for the rendered clip.
 * The signed URL is valid for 1 hour.
 */
export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url)
  const clipId = searchParams.get('clip_id')

  if (!clipId) {
    return NextResponse.json(
      { data: null, error: 'Missing clip_id', message: 'clip_id is required' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Fetch clip and verify ownership
  const { data: clip, error: clipError } = await admin
    .from('clips')
    .select('id, storage_path, title, status, user_id')
    .eq('id', clipId)
    .eq('user_id', user.id)
    .single()

  if (clipError || !clip) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  if (clip.status !== 'done' || !clip.storage_path) {
    return NextResponse.json(
      {
        data: null,
        error: 'Clip not ready',
        message: clip.status === 'rendering'
          ? 'Le clip est en cours de rendu. Réessayez dans quelques secondes.'
          : 'Le clip n\'a pas encore été rendu.',
      },
      { status: 409 }
    )
  }

  // Generate signed URL (valid for 1 hour)
  const { data: signedData, error: signedError } = await admin.storage
    .from('clips')
    .createSignedUrl(clip.storage_path, 3600, {
      download: `${clip.title ?? 'clip'}.mp4`,
    })

  if (signedError || !signedData?.signedUrl) {
    console.error('[download] Signed URL error:', signedError)
    return NextResponse.json(
      { data: null, error: 'Download failed', message: 'Impossible de générer le lien de téléchargement' },
      { status: 500 }
    )
  }

  // Redirect to signed URL for direct download
  return NextResponse.redirect(signedData.signedUrl)
})
