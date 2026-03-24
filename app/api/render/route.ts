import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'

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
      smartZoom: z.boolean().optional(),
      backgroundBlur: z.boolean().optional(),
    }).optional(),
    branding: z.object({
      watermark: z.boolean().optional(),
      watermarkPosition: z.string().optional(),
      creditText: z.string().optional(),
    }).optional(),
  }).optional(),
})

// ── Route handler — Proxy to VPS Render API ──────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Non autorisé' },
      { status: 401 }
    )
  }

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

  // Fetch clip + video + transcription
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

  // Get user plan for feature gating
  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const planConfig = getPlanConfig(profile?.plan)

  // Gate split-screen to Studio plan
  if (settings?.splitScreen?.enabled && !planConfig.limits.splitScreen) {
    return NextResponse.json(
      { data: null, error: 'Feature not available', message: `Le split-screen nécessite le plan Studio (${planConfig.name} actuel)` },
      { status: 403 }
    )
  }

  // Mark clip as rendering
  await admin.from('clips').update({ status: 'rendering' }).eq('id', clip_id)

  // ── Send render job to VPS ──────────────────────────────────────────────────

  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
    // Fallback: mark as done without rendering (no VPS configured)
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

  try {
    // Build render request for VPS
    const renderPayload = {
      videoStoragePath: video.storage_path,
      clipStartTime: clip.start_time,
      clipEndTime: clip.end_time,
      clipId: clip_id,
      wordTimestamps: transcription?.word_timestamps ?? [],
      settings: {
        captions: settings?.captions ?? { enabled: false },
        splitScreen: settings?.splitScreen ?? { enabled: false },
        format: {
          aspectRatio: settings?.format?.aspectRatio ?? '9:16',
          smartZoom: settings?.format?.smartZoom ?? false,
          backgroundBlur: settings?.format?.backgroundBlur ?? false,
        },
        branding: {
          watermark: planConfig.limits.watermarkForced ? true : (settings?.branding?.watermark ?? false),
          watermarkPosition: settings?.branding?.watermarkPosition ?? 'bottom-right',
          creditText: settings?.branding?.creditText ?? null,
        },
      },
    }

    const vpsResponse = await fetch(`${vpsUrl}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vpsKey,
      },
      body: JSON.stringify(renderPayload),
      signal: AbortSignal.timeout(300_000), // 5 min timeout
    })

    if (!vpsResponse.ok) {
      const errorData = await vpsResponse.json().catch(() => ({}))
      throw new Error(
        (errorData as Record<string, string>).error || `VPS responded with ${vpsResponse.status}`
      )
    }

    const result = await vpsResponse.json() as {
      success: boolean
      clipUrl: string
      storagePath: string
      renderTime: string
    }

    return NextResponse.json({
      data: {
        clip_id,
        storage_path: result.storagePath,
        clip_url: result.clipUrl,
        render_time: result.renderTime,
        rendered: true,
      },
      error: null,
      message: `Rendu terminé en ${result.renderTime}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur de rendu VPS'
    await admin
      .from('clips')
      .update({ status: 'error' })
      .eq('id', clip_id)

    return NextResponse.json(
      { data: null, error: msg, message: `Rendu échoué : ${msg}` },
      { status: 500 }
    )
  }
}

// Expose types for use in create page
export type RenderResult = {
  clip_id: string
  storage_path?: string
  clip_url?: string
  render_time?: string
  duration?: number
  rendered: boolean
}
