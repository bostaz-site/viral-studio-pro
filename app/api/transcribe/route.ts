import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { transcribeAudio } from '@/lib/whisper'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { Json } from '@/lib/supabase/types'

// OpenAI Whisper file size limit is 25MB
const WHISPER_MAX_BYTES = 25 * 1024 * 1024
const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql'
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

/**
 * For Twitch clips over 25MB, fetch a lower quality version directly
 * from Twitch's CDN (360p is typically 2-5MB for a 30s clip).
 */
async function fetchLowerQualityTwitchClip(sourceUrl: string): Promise<{ buffer: Buffer; filename: string } | null> {
  // Extract slug from Twitch URL
  let slug: string | null = null
  try {
    const url = new URL(sourceUrl)
    if (url.hostname === 'clips.twitch.tv') {
      slug = url.pathname.replace('/', '')
    } else if (url.hostname === 'www.twitch.tv' || url.hostname === 'twitch.tv') {
      const match = url.pathname.match(/^\/[^/]+\/clip\/([^/]+)$/)
      if (match) slug = match[1]
    }
  } catch { /* not a valid URL */ }

  if (!slug) return null

  // Get video URLs + access token from Twitch GQL
  const gqlRes = await fetch(TWITCH_GQL_URL, {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        clip(slug: "${slug.replace(/"/g, '')}") {
          playbackAccessToken(params: {platform: "web", playerType: "site"}) {
            signature
            value
          }
          videoQualities {
            quality
            sourceURL
          }
        }
      }`,
    }),
  })

  if (!gqlRes.ok) return null
  const gqlData = await gqlRes.json()
  const clip = gqlData?.data?.clip
  const token = clip?.playbackAccessToken
  const qualities = clip?.videoQualities as Array<{ quality: string; sourceURL: string }> | undefined

  if (!token || !qualities || qualities.length === 0) return null

  // Pick lowest quality (360p or smallest available)
  const sorted = [...qualities].sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
  const lowest = sorted[0]

  const videoUrl = `${lowest.sourceURL}?sig=${token.signature}&token=${encodeURIComponent(token.value)}`
  console.log(`[transcribe] Downloading ${lowest.quality}p version from Twitch CDN`)

  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) return null

  const arrayBuf = await videoRes.arrayBuffer()
  return { buffer: Buffer.from(arrayBuf), filename: `clip_${lowest.quality}p.mp4` }
}

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

    // If file exceeds Whisper's 25MB limit, try to get a smaller version
    if (buffer.length > WHISPER_MAX_BYTES) {
      console.log(`[transcribe] File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Trying lower quality...`)

      // For Twitch clips, fetch a lower quality version from CDN
      if (video.source_url) {
        try {
          const lowerQuality = await fetchLowerQualityTwitchClip(video.source_url)
          if (lowerQuality && lowerQuality.buffer.length <= WHISPER_MAX_BYTES) {
            buffer = lowerQuality.buffer
            filename = lowerQuality.filename
            console.log(`[transcribe] Using lower quality: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`)
          } else {
            throw new Error('Lower quality version still exceeds 25MB or unavailable')
          }
        } catch (dlError) {
          await admin
            .from('videos')
            .update({ status: 'error', error_message: `Video too large for transcription (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 25MB limit). ${String(dlError)}` })
            .eq('id', video_id)
          return NextResponse.json(
            { data: null, error: 'Video too large', message: 'La vidéo dépasse la limite de 25MB pour la transcription. Essayez un clip plus court.' },
            { status: 413 }
          )
        }
      } else {
        // Non-Twitch upload — no way to get a smaller version without ffmpeg
        await admin
          .from('videos')
          .update({ status: 'error', error_message: `Video too large for transcription: ${(buffer.length / 1024 / 1024).toFixed(1)}MB > 25MB limit` })
          .eq('id', video_id)
        return NextResponse.json(
          { data: null, error: 'Video too large', message: 'La vidéo dépasse la limite de 25MB. Essayez une vidéo plus courte ou compressée.' },
          { status: 413 }
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
