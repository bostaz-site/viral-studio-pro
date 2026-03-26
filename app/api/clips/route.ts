import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const createClipSchema = z.object({
  video_id: z.string().uuid(),
  start_time: z.number().min(0),
  end_time: z.number().min(0),
  title: z.string().min(1).optional(),
  aspect_ratio: z.enum(['9:16', '1:1', '16:9']).optional(),
})

const deleteClipSchema = z.object({
  clip_id: z.string().uuid(),
})

// GET /api/clips?video_id=xxx
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('video_id')

    const admin = createAdminClient()
    let query = admin
      .from('clips')
      .select(`
        *,
        viral_scores (
          score,
          hook_strength,
          emotional_flow,
          perceived_value,
          trend_alignment,
          hook_type,
          explanation,
          suggested_hooks
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (videoId) {
      query = query.eq('video_id', videoId)
    }

    const { data: clips, error: clipsError } = await query

    if (clipsError) {
      return NextResponse.json(
        { data: null, error: clipsError.message, message: 'Failed to fetch clips' },
        { status: 500 }
      )
    }

    // Resolve thumbnail signed URLs for clips that have thumbnails
    const clipsWithUrls = await Promise.all(
      (clips ?? []).map(async (clip) => {
        let thumbnail_url: string | null = null
        if (clip.thumbnail_path) {
          try {
            const { data: signedData } = await admin.storage
              .from('thumbnails')
              .createSignedUrl(clip.thumbnail_path, 3600) // 1 hour
            thumbnail_url = signedData?.signedUrl ?? null
          } catch {
            // Ignore thumbnail URL errors
          }
        }
        return { ...clip, thumbnail_url }
      })
    )

    return NextResponse.json({
      data: clipsWithUrls,
      error: null,
      message: `${clipsWithUrls.length} clip(s) found`,
    })
  } catch (error) {
    console.error('[clips] Error:', error)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/clips — create clip manually
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

    const body = await request.json()
    const parsed = createClipSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message, message: 'Invalid input' },
        { status: 400 }
      )
    }

    const { video_id, start_time, end_time, title, aspect_ratio } = parsed.data

    if (end_time <= start_time) {
      return NextResponse.json(
        { data: null, error: 'end_time must be greater than start_time', message: 'Invalid time range' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify the video belongs to this user
    const { data: video, error: videoError } = await admin
      .from('videos')
      .select('id')
      .eq('id', video_id)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { data: null, error: 'Video not found', message: 'Video not found' },
        { status: 404 }
      )
    }

    const { data: clip, error: clipError } = await admin
      .from('clips')
      .insert({
        video_id,
        user_id: user.id,
        title: title ?? null,
        start_time,
        end_time,
        duration_seconds: end_time - start_time,
        aspect_ratio: aspect_ratio ?? '9:16',
        status: 'pending',
        is_remake: false,
      })
      .select()
      .single()

    if (clipError) {
      return NextResponse.json(
        { data: null, error: clipError.message, message: 'Failed to create clip' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: clip,
        error: null,
        message: 'Clip created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[clips] Error:', error)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// DELETE /api/clips
export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const parsed = deleteClipSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message, message: 'Invalid input' },
        { status: 400 }
      )
    }

    const { clip_id } = parsed.data
    const admin = createAdminClient()

    // Verify ownership before deleting
    const { data: clip, error: fetchError } = await admin
      .from('clips')
      .select('id, storage_path, thumbnail_path')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !clip) {
      return NextResponse.json(
        { data: null, error: 'Clip not found', message: 'Clip not found' },
        { status: 404 }
      )
    }

    // Delete storage files if they exist
    const filesToDelete: string[] = []
    if (clip.storage_path) filesToDelete.push(clip.storage_path)
    if (clip.thumbnail_path) filesToDelete.push(clip.thumbnail_path)
    if (filesToDelete.length > 0) {
      await admin.storage.from('clips').remove(filesToDelete)
    }

    const { error: deleteError } = await admin
      .from('clips')
      .delete()
      .eq('id', clip_id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json(
        { data: null, error: deleteError.message, message: 'Failed to delete clip' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { clip_id },
      error: null,
      message: 'Clip deleted successfully',
    })
  } catch (error) {
    console.error('[clips] Error:', error)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
