import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const inputSchema = z.object({
  clip_id: z.string().uuid(),
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

  const { clip_id, settings } = parsed.data
  const admin = createAdminClient()

  // Fetch clip + video
  const { data: clip } = await admin
    .from('clips')
    .select('*, videos(storage_path, duration_seconds, title)')
    .eq('id', clip_id)
    .eq('user_id', user.id)
    .single()

  if (!clip) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  const video = (clip.videos as unknown) as {
    storage_path: string
    duration_seconds: number | null
    title: string | null
  } | null

  if (!video?.storage_path) {
    return NextResponse.json(
      { data: null, error: 'Video not found', message: 'Vidéo source introuvable' },
      { status: 404 }
    )
  }

  // Get word timestamps for subtitles
  const { data: transcription } = await admin
    .from('transcriptions')
    .select('word_timestamps')
    .eq('video_id', clip.video_id ?? '')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Mark clip as rendering
  await admin.from('clips').update({ status: 'rendering' }).eq('id', clip_id)

  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
    await admin
      .from('clips')
      .update({ status: 'done', storage_path: null })
      .eq('id', clip_id)
    return NextResponse.json({
      data: { clip_id, rendered: false },
      error: null,
      message: 'VPS de rendu non configuré — clip marqué sans rendu vidéo',
    })
  }

  const renderPayload = {
    videoStoragePath: video.storage_path,
    clipStartTime: clip.start_time,
    clipEndTime: clip.end_time,
    clipId: clip_id,
    wordTimestamps: transcription?.word_timestamps ?? [],
    settings: {
      captions: settings?.captions ?? { enabled: true, style: 'hormozi', wordsPerLine: 4 },
      splitScreen: settings?.splitScreen ?? { enabled: false },
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
    data: { clip_id, rendered: false, message: 'Rendu lancé en arrière-plan' },
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
}
