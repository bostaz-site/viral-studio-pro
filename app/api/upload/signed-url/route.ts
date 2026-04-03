import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { withAuth } from '@/lib/api/withAuth'

/**
 * POST /api/upload/signed-url
 *
 * Returns a Supabase Storage signed upload URL so the browser can upload
 * directly to storage, bypassing the Netlify Functions ~6 MB body limit.
 *
 * Body: { fileName: string, fileSize: number, mimeType: string }
 */

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
]

export const POST = withAuth(async (request, user) => {
  try {
    // Rate limiting
    const rl = rateLimit(user.id, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs)
    if (!rl.allowed) {
      return NextResponse.json(
        { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
        { status: 429 }
      )
    }

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

    const admin = createAdminClient()

    // Get plan config
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, monthly_videos_used')
      .eq('id', user.id)
      .single()

    const planConfig = getPlanConfig(profile?.plan)
    const maxSizeBytes = planConfig.limits.maxUploadSizeMB * 1024 * 1024
    const maxVideos = planConfig.limits.maxVideosPerMonth

    if (fileSize > maxSizeBytes) {
      return NextResponse.json(
        { data: null, error: 'File too large', message: `La taille max est ${planConfig.limits.maxUploadSizeMB}MB pour le plan ${planConfig.name}` },
        { status: 400 }
      )
    }

    // Increment quota
    const { data: quotaAllowed, error: rpcError } = await admin.rpc('increment_video_usage', {
      p_user_id: user.id,
      p_max_videos: maxVideos,
    })

    if (rpcError || !quotaAllowed) {
      return NextResponse.json(
        { data: null, error: 'Plan limit reached', message: `Limite atteinte : ${maxVideos === -1 ? '∞' : maxVideos} vidéos/mois sur le plan ${planConfig.name}. Passez au plan supérieur.` },
        { status: 403 }
      )
    }

    // Generate video ID and storage path
    const videoId = crypto.randomUUID()
    const ext = fileName.split('.').pop() ?? 'mp4'
    const storagePath = `${user.id}/${videoId}/source.${ext}`

    // Create signed upload URL (valid for 10 minutes)
    const { data: signedData, error: signedError } = await admin.storage
      .from('videos')
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedData) {
      // Rollback quota
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
      return NextResponse.json(
        { data: null, error: signedError?.message ?? 'Failed to create upload URL', message: 'Erreur lors de la création de l\'URL d\'upload' },
        { status: 500 }
      )
    }

    // Pre-create the video record with status 'uploading'
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
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
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
        usage: {
          used: (profile?.monthly_videos_used ?? 0) + 1,
          limit: maxVideos,
          plan: planConfig.id,
        },
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
