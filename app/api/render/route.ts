import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const inputSchema = z.object({
  clip_id: z.string().uuid(),
  source: z.enum(['clips', 'trending']).optional().default('trending'),
  settings: z.object({
    captions: z.object({
      enabled: z.boolean().optional(),
      style: z.string().optional(),
      fontSize: z.number().optional(),
      color: z.string().optional(),
      position: z.string().optional(),
      wordsPerLine: z.number().optional(),
      animation: z.string().optional(),
    }).optional(),
    splitScreen: z.object({
      enabled: z.boolean().optional(),
      layout: z.string().optional(),
      brollCategory: z.string().optional(),
      ratio: z.number().optional(),
    }).optional(),
    hook: z.object({
      enabled: z.boolean().optional(),
      text: z.string().optional(),
    }).optional(),
    format: z.object({
      aspectRatio: z.string().optional(),
    }).optional(),
  }).optional(),
})

export const POST = withAuth(async (request, user) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON', message: 'Corps invalide' },
      { status: 400 }
    )
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const { clip_id, source, settings } = parsed.data
  const admin = createAdminClient()

  // ── Try trending_clips first (Browse Clips flow), then user clips ──
  let videoUrl: string | null = null
  let clipTitle: string | null = null
  let clipDuration: number | null = null
  let foundSource: 'trending' | 'clips' | null = null

  if (source === 'trending') {
    const { data: trendingClip } = await admin
      .from('trending_clips')
      .select('*')
      .eq('id', clip_id)
      .single()

    if (trendingClip) {
      foundSource = 'trending'
      videoUrl = trendingClip.external_url
      clipTitle = trendingClip.title
      clipDuration = (trendingClip as Record<string, unknown>).duration_seconds as number | null
    }
  }

  // Fallback: check user clips table
  if (!foundSource) {
    const { data: clip } = await admin
      .from('clips')
      .select('*, videos(storage_path, duration_seconds, title)')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .single()

    if (clip) {
      foundSource = 'clips'
      const video = (clip.videos as unknown) as {
        storage_path: string
        duration_seconds: number | null
        title: string | null
      } | null
      videoUrl = video?.storage_path ?? null
      clipTitle = video?.title ?? clip.title
      clipDuration = video?.duration_seconds ?? clip.duration_seconds
    }
  }

  if (!foundSource || !videoUrl) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  // ── VPS render ──
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
    return NextResponse.json({
      data: { clip_id, rendered: false, source: foundSource, vpsReady: false, originalUrl: videoUrl },
      error: null,
      message: 'Le serveur de rendu n\'est pas encore configuré. Tu peux télécharger le clip original en attendant.',
    })
  }

  // Get word timestamps for subtitles (only for user clips with transcriptions)
  let wordTimestamps: unknown[] = []
  if (foundSource === 'clips') {
    const { data: transcription } = await admin
      .from('transcriptions')
      .select('word_timestamps')
      .eq('video_id', clip_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    wordTimestamps = (transcription?.word_timestamps as unknown[] | null) ?? []
  }

  const renderPayload = {
    videoUrl,
    clipId: clip_id,
    source: foundSource,
    clipTitle,
    clipDuration,
    wordTimestamps,
    settings: {
      captions: settings?.captions ?? { enabled: true, style: 'hormozi', wordsPerLine: 4 },
      splitScreen: settings?.splitScreen ?? { enabled: false },
      hook: settings?.hook ?? { enabled: false },
      format: {
        aspectRatio: settings?.format?.aspectRatio ?? '9:16',
      },
    },
  }

  // Fire-and-forget to VPS
  fetch(`${vpsUrl}/api/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': vpsKey,
    },
    body: JSON.stringify(renderPayload),
  }).catch((err) => {
    console.error('[render] VPS fire-and-forget error:', err)
  })

  return NextResponse.json({
    data: { clip_id, rendered: false, source: foundSource, vpsReady: true, originalUrl: videoUrl },
    error: null,
    message: 'Rendu lancé — le clip sera prêt dans quelques secondes',
  })
})

export type RenderResult = {
  clip_id: string
  storage_path?: string
  clip_url?: string
  render_time?: string
  duration?: number
  rendered: boolean
  source?: string
}
