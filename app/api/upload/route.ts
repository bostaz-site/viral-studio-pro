import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkVideoLimit, getPlanConfig } from '@/lib/plans'

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

    const admin = createAdminClient()

    // ── Plan enforcement: check video limit ─────────────────────────────────
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, monthly_videos_used')
      .eq('id', user.id)
      .single()

    const usageCheck = checkVideoLimit(profile?.plan, profile?.monthly_videos_used)
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { data: null, error: 'Plan limit reached', message: usageCheck.reason },
        { status: 403 }
      )
    }

    // ── Plan enforcement: check file size limit ─────────────────────────────
    const planConfig = getPlanConfig(profile?.plan)
    const maxSizeBytes = planConfig.limits.maxUploadSizeMB * 1024 * 1024

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
      // Cleanup storage if DB insert fails
      await admin.storage.from('videos').remove([storagePath])
      return NextResponse.json(
        { data: null, error: dbError.message, message: 'Failed to save video metadata' },
        { status: 500 }
      )
    }

    // ── Increment monthly usage counter ────────────────────────────────────
    await admin
      .from('profiles')
      .update({
        monthly_videos_used: (profile?.monthly_videos_used ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    return NextResponse.json({
      data: {
        video_id: video.id,
        storage_path: storagePath,
        usage: {
          used: (profile?.monthly_videos_used ?? 0) + 1,
          limit: usageCheck.limit,
          plan: usageCheck.plan,
        },
      },
      error: null,
      message: 'Video uploaded successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { data: null, error: String(error), message: 'Internal server error' },
      { status: 500 }
    )
  }
}
