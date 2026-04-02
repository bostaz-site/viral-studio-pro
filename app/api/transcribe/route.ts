import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { transcribeAudio } from '@/lib/whisper'
import { extractAudioFromVideo } from '@/lib/whisper/extract-audio'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { Json } from '@/lib/supabase/types'

// OpenAI Whisper file size limit is 25MB
const WHISPER_MAX_BYTES = 25 * 1024 * 1024

const srtDataSchema = z.object({
  full_text: z.string().min(1),
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
  word_timestamps: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })),
})

const inputSchema = z.object({
  video_id: z.string().uuid(),
  srt_data: srtDataSchema.optional(),
})

export const POST = withAuth(async (request, user) => {
  // ── Rate limiting (AI operation: 5 req/min) ─────────────────────────────
  const rl = rateLimit(user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
      { status: 429 }
    )
  }

  const body = await request.json()
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Invalid input' },
      { status: 400 }
    )
  }

  const { video_id, srt_data } = parsed.data
  const admin = createAdminClient()

  const { data: video, error: videoError } = await admin
    .from('videos')
    .select()
    .eq('id', video_id)
    .eq('user_id', user.id)
    .single()

  if (videoError || !video) {
    return NextResponse.json(
      { data: null, error: 'Video not found', message: 'Video not found' },
      { status: 404 }
    )
  }

  await admin.from('videos').update({ status: 'transcribing' }).eq('id', video_id)

  let transcription: {
    language: string
    full_text: string
    segments: Array<{ start: number; end: number; text: string }>
    word_timestamps: Array<{ word: string; start: number; end: number }>
  }

  if (srt_data) {
    // SRT path — use pre-parsed data, skip Whisper
    transcription = {
      language: 'unknown',
      full_text: srt_data.full_text,
      segments: srt_data.segments,
      word_timestamps: srt_data.word_timestamps,
    }
  } else {
    // Whisper path — download video and transcribe
    const { data: fileData, error: downloadError } = await admin.storage
      .from('videos')
      .download(video.storage_path)

    if (downloadError || !fileData) {
      await admin
        .from('videos')
        .update({ status: 'error', error_message: 'Failed to download video for transcription' })
        .eq('id', video_id)
      return NextResponse.json(
        { data: null, error: downloadError?.message ?? 'Download failed', message: 'Failed to download video' },
        { status: 500 }
      )
    }

    const arrayBuffer = await fileData.arrayBuffer()
    let buffer: Buffer = Buffer.from(arrayBuffer)
    let filename: string = video.storage_path.split('/').pop() ?? 'video.mp4'

    // If file exceeds Whisper's 25MB limit, extract audio track as MP3
    if (buffer.length > WHISPER_MAX_BYTES) {
      try {
        const audio = await extractAudioFromVideo(buffer, filename)
        buffer = audio.buffer
        filename = audio.filename
        console.log(`[transcribe] Extracted audio: ${(buffer.length / 1024).toFixed(0)}KB from ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB video`)
      } catch (ffmpegError) {
        await admin
          .from('videos')
          .update({ status: 'error', error_message: `Audio extraction failed: ${String(ffmpegError)}` })
          .eq('id', video_id)
        return NextResponse.json(
          { data: null, error: String(ffmpegError), message: 'Failed to extract audio from video' },
          { status: 500 }
        )
      }
    }

    try {
      transcription = await transcribeAudio(buffer, filename)
    } catch (whisperError) {
      await admin
        .from('videos')
        .update({ status: 'error', error_message: String(whisperError) })
        .eq('id', video_id)
      return NextResponse.json(
        { data: null, error: String(whisperError), message: 'Transcription failed' },
        { status: 500 }
      )
    }
  }

  // Use intermediate variable to avoid TypeScript excess property checking on intersection types
  const transcriptionInsert = {
    video_id,
    language: transcription.language,
    full_text: transcription.full_text,
    segments: transcription.segments as unknown as Json,
    word_timestamps: transcription.word_timestamps as unknown as Json,
  }

  const { data: savedTranscription, error: transcribeDbError } = await admin
    .from('transcriptions')
    .insert(transcriptionInsert)
    .select()
    .single()

  if (transcribeDbError) {
    await admin
      .from('videos')
      .update({ status: 'error', error_message: transcribeDbError.message })
      .eq('id', video_id)
    return NextResponse.json(
      { data: null, error: transcribeDbError.message, message: 'Failed to save transcription' },
      { status: 500 }
    )
  }

  await admin.from('videos').update({ status: 'analyzing' }).eq('id', video_id)

  return NextResponse.json({
    data: {
      transcription_id: savedTranscription.id,
      language: transcription.language,
      word_count: transcription.full_text.split(' ').length,
      segment_count: transcription.segments.length,
    },
    error: null,
    message: 'Transcription completed successfully',
  })
})
