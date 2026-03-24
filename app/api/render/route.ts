import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSmartZoomFilters, detectEmphasisTimestamps, type ZoomPoint } from '@/lib/ffmpeg/speaker-track'

const execAsync = promisify(exec)

const inputSchema = z.object({
  clip_id: z.string().uuid(),
  smart_zoom: z.boolean().optional().default(false),
})

// ── ASS subtitle generation ───────────────────────────────────────────────────

interface WordTS {
  word: string
  start: number
  end: number
}

function toASSTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.round((sec % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function buildASSContent(
  words: WordTS[],
  clipStart: number,
  primaryColor = '&H00FFFFFF',
  activeColor = '&H0000FFFF',
  wordsPerGroup = 4
): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Arial,72,${primaryColor},${activeColor},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,10,10,60,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`

  const lines: string[] = [header]

  // Group words into chunks
  for (let i = 0; i < words.length; i += wordsPerGroup) {
    const group = words.slice(i, i + wordsPerGroup)
    const groupStart = group[0].start - clipStart
    const groupEnd = group[group.length - 1].end - clipStart
    if (groupEnd <= 0) continue

    // Build karaoke text: each word highlighted in turn
    const parts = group.map((w) => {
      const dur = Math.round((w.end - w.start) * 100) // centiseconds
      return `{\\k${dur}}${w.word}`
    })

    const text = parts.join(' ')
    lines.push(
      `Dialogue: 0,${toASSTime(Math.max(0, groupStart))},${toASSTime(Math.max(0, groupEnd))},Default,,0,0,0,,${text}`
    )
  }

  return lines.join('\n')
}

// ── FFmpeg command builder ────────────────────────────────────────────────────

function buildRenderCommand(opts: {
  inputPath: string
  outputPath: string
  assPath: string | null
  startTime: number
  duration: number
  plan: string
  hasAudio: boolean
  logoPath?: string | null
  smartZoom?: boolean
  zoomPoints?: ZoomPoint[]
}): string {
  const { inputPath, outputPath, assPath, startTime, duration, plan } = opts

  // Escape paths for FFmpeg filter (forward slashes + escape colons on Windows)
  const escapePath = (p: string) =>
    p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")

  // Video filter chain
  const filters: string[] = []

  if (opts.smartZoom) {
    // Smart zoom replaces the plain scale+crop with a zoompan-based pipeline
    const smartFilters = buildSmartZoomFilters({
      inputWidth: 1920,   // assume wide source; zoompan prescales first
      inputHeight: 1080,
      duration,
      zoomPoints: opts.zoomPoints,
    })
    filters.push(...smartFilters.split(','))
  } else {
    // Standard reframe to 9:16
    filters.push(`scale=1080:1920:force_original_aspect_ratio=increase`)
    filters.push(`crop=1080:1920`)
  }

  // Karaoke subtitles
  if (assPath) {
    filters.push(`ass='${escapePath(assPath)}'`)
  }

  // Watermark
  if (plan === 'free') {
    filters.push(
      `drawtext=text='Viral Studio Pro':fontsize=26:fontcolor=white@0.70:shadowcolor=black@0.5:shadowx=1:shadowy=1:x=w-tw-20:y=h-th-20`
    )
  } else if ((plan === 'pro' || plan === 'studio') && opts.logoPath) {
    // Logo watermark handled via separate input
  }

  const vf = filters.join(',')

  const parts = [
    'ffmpeg -y',
    `-ss ${startTime.toFixed(3)}`,
    `-i "${inputPath}"`,
    `-t ${duration.toFixed(3)}`,
    `-vf "${vf}"`,
    '-c:v libx264 -preset fast -crf 23',
    opts.hasAudio ? '-c:a aac -b:a 128k' : '-an',
    '-movflags +faststart',
    '-pix_fmt yuv420p',
    `"${outputPath}"`,
  ]

  return parts.join(' ')
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  const { clip_id, smart_zoom } = parsed.data
  const admin = createAdminClient()

  // Check ffmpeg availability
  try {
    await execAsync('ffmpeg -version', { timeout: 5000 })
  } catch {
    // ffmpeg not available — mark clip as done without rendering (graceful degradation)
    await admin
      .from('clips')
      .update({ status: 'done', storage_path: null })
      .eq('id', clip_id)
    return NextResponse.json({
      data: { clip_id, rendered: false },
      error: null,
      message: 'FFmpeg non disponible — clip marqué sans rendu vidéo',
    })
  }

  // Fetch clip + video + transcription + user plan
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

  const video = (clip.videos as unknown) as { storage_path: string; duration_seconds: number | null; title: string | null } | null
  if (!video?.storage_path) {
    return NextResponse.json(
      { data: null, error: 'Video not found', message: 'Vidéo source introuvable' },
      { status: 404 }
    )
  }

  // Get user plan
  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = profile?.plan ?? 'free'

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

  // Create temp directory
  const tmpDir = join(tmpdir(), `vsp_render_${clip_id}`)
  await mkdir(tmpDir, { recursive: true })

  const tmpInput = join(tmpDir, 'input.mp4')
  const tmpOutput = join(tmpDir, 'output.mp4')
  const tmpAss = join(tmpDir, 'subs.ass')

  try {
    // Download source video from Supabase Storage
    const { data: signedUrl } = await admin.storage
      .from('videos')
      .createSignedUrl(video.storage_path, 600)

    if (!signedUrl?.signedUrl) {
      throw new Error('Impossible de générer l\'URL signée pour la vidéo source')
    }

    const videoRes = await fetch(signedUrl.signedUrl)
    if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`)
    const videoBuffer = await videoRes.arrayBuffer()
    await writeFile(tmpInput, Buffer.from(videoBuffer))

    // Generate ASS subtitles from word timestamps
    let assPath: string | null = null
    const wordTs = transcription?.word_timestamps as WordTS[] | null
    if (wordTs && Array.isArray(wordTs) && wordTs.length > 0) {
      const relevantWords = wordTs.filter(
        (w) => w.start >= clip.start_time && w.start < clip.end_time
      )
      if (relevantWords.length > 0) {
        const assContent = buildASSContent(relevantWords, clip.start_time)
        await writeFile(tmpAss, assContent, 'utf-8')
        assPath = tmpAss
      }
    }

    // Build and run FFmpeg
    const duration = clip.end_time - clip.start_time

    // Detect emphasis timestamps for Smart Zoom (uses word timestamps if available)
    const zoomPoints =
      smart_zoom && wordTs && Array.isArray(wordTs)
        ? detectEmphasisTimestamps(wordTs, clip.start_time, clip.end_time)
        : []

    const cmd = buildRenderCommand({
      inputPath: tmpInput,
      outputPath: tmpOutput,
      assPath,
      startTime: clip.start_time,
      duration,
      plan,
      hasAudio: true,
      smartZoom: smart_zoom,
      zoomPoints,
    })

    await execAsync(cmd, { timeout: 300_000 }) // 5 min max

    // Upload rendered clip to Supabase Storage
    const outputBuffer = await readFile(tmpOutput)
    const storagePath = `${user.id}/${clip_id}.mp4`

    const { error: uploadError } = await admin.storage
      .from('clips')
      .upload(storagePath, outputBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (uploadError) throw new Error(`Upload to Storage failed: ${uploadError.message}`)

    // Generate thumbnail path (if we have a thumbnail, use it)
    // For now, set thumbnail_path to null — can be added later with ffmpeg -vframes 1
    await admin
      .from('clips')
      .update({
        storage_path: storagePath,
        status: 'done',
        duration_seconds: duration,
      })
      .eq('id', clip_id)

    return NextResponse.json({
      data: { clip_id, storage_path: storagePath, duration },
      error: null,
      message: 'Rendu terminé',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur FFmpeg'
    await admin
      .from('clips')
      .update({ status: 'error' })
      .eq('id', clip_id)

    return NextResponse.json(
      { data: null, error: msg, message: `Rendu échoué : ${msg}` },
      { status: 500 }
    )
  } finally {
    // Clean up temp files
    await Promise.allSettled([
      unlink(tmpInput).catch(() => null),
      unlink(tmpOutput).catch(() => null),
      unlink(tmpAss).catch(() => null),
    ])
  }
}

// Expose types for use in create page
export type RenderResult = {
  clip_id: string
  storage_path?: string
  duration?: number
  rendered: boolean
}
