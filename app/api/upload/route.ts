import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
]

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // ── Rate limiting ───────────────────────────────────────────────────────
    const rl = rateLimit(user.id, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs)
    if (!rl.allowed) {
      return NextResponse.json(
        { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
        { status: 429 }
      )
    }

    const admin = createAdminClient()

    // ── Plan enforcement: get plan config ────────────────────────────────────
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, monthly_videos_used')
      .eq('id', user.id)
      .single()

    const planConfig = getPlanConfig(profile?.plan)
    const maxSizeBytes = planConfig.limits.maxUploadSizeMB * 1024 * 1024
    const maxVideos = planConfig.limits.maxVideosPerMonth

    // ── Validate file BEFORE consuming quota ────────────────────────────────
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
        {
          data: null,
          error: 'Invalid file type',
          message: 'Only MP4, MOV, MKV, AVI files are allowed',
        },
        { status: 400 }
      )
    }

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { data: null, error: 'File too large', message: `La taille max est ${planConfig.limits.maxUploadSizeMB}MB pour le plan ${planConfig.name}` },
        { status: 400 }
      )
    }

    // ── NOW increment quota (after all validations pass) ────────────────────
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

    // From here on, if anything fails we should rollback the quota
    const videoId = crypto.randomUUID()
    const ext = file.name.split('.').pop() ?? 'mp4'
    const storagePath = `${user.id}/${videoId}/source.${ext}`

    const { error: storageError } = await admin.storage
      .from('videos')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (storageError) {
      // Rollback quota
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
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
      // Cleanup storage + rollback quota if DB insert fails
      await admin.storage.from('videos').remove([storagePath])
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
      return NextResponse.json(
        { data: null, error: dbError.message, message: 'Failed to save video metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        video_id: video.id,
        storage_path: storagePath,
        usage: {
          used: (profile?.monthly_videos_used ?? 0) + 1,
          limit: maxVideos,
          plan: planConfig.id,
        },
      },
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
}
