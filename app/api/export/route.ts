import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

const bodySchema = z.object({
  clip_id: z.string().uuid(),
})

/**
 * POST /api/export
 *
 * Generates a temporary signed download URL for a rendered clip.
 * Also returns clip metadata (title, transcript) for caption generation.
 */
export const POST = withAuth(async (req, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON', message: 'Corps invalide' },
      { status: 400 }
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { clip_id } = parsed.data

  // Fetch clip with video info
  const { data: clip, error: clipError } = await admin
    .from('clips')
    .select('id, title, storage_path, transcript_segment, duration_seconds, video_id, status')
    .eq('id', clip_id)
    .eq('user_id', user.id)
    .single()

  if (clipError || !clip) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable ou accès refusé' },
      { status: 404 }
    )
  }

  // Generate signed URL for download (valid 1 hour)
  let downloadUrl: string | null = null

  if (clip.storage_path && clip.status === 'done') {
    const { data: signedData, error: signError } = await admin.storage
      .from('clips')
      .createSignedUrl(clip.storage_path, 3600) // 1 hour

    if (!signError && signedData?.signedUrl) {
      downloadUrl = signedData.signedUrl
    }
  }

  // Fetch viral score for export metadata
  const { data: viralScore } = await admin
    .from('viral_scores')
    .select('score, hook_type, explanation, suggested_hooks')
    .eq('clip_id', clip_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    data: {
      clip_id: clip.id,
      title: clip.title,
      transcript: clip.transcript_segment,
      duration: clip.duration_seconds,
      status: clip.status,
      download_url: downloadUrl,
      viral_score: viralScore?.score ?? null,
      hook_type: viralScore?.hook_type ?? null,
      suggested_hooks: viralScore?.suggested_hooks ?? null,
    },
    error: null,
    message: downloadUrl ? 'URL de téléchargement générée' : 'Clip pas encore rendu',
  })
})
