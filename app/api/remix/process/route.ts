import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { downloadVideo, readVideoFile, cleanupTempFile } from '@/lib/ytdlp'
import { transcribeAudio } from '@/lib/whisper'
import { runHookHunter } from '@/lib/claude/hook-hunter'
import { runRetentionEditor } from '@/lib/claude/retention-editor'
import { runCreditManager } from '@/lib/claude/credit-manager'
import { buildSingleSourceSplitScreen } from '@/lib/ffmpeg/split-screen'
import type { Json } from '@/lib/supabase/types'

const bodySchema = z.object({
  video_id: z.string().uuid(),
  user_id: z.string().uuid(),
  trending_clip_id: z.string().uuid(),
  external_url: z.string().url(),
  platform: z.string(),
  author_name: z.string(),
})

/**
 * POST /api/remix/process — Background processing endpoint.
 *
 * Called by n8n or VPS after the remix job is initiated.
 * This does the heavy work: download → transcribe → analyze → create clips.
 * Protected by API key auth (not user auth).
 *
 * NOTE: On Netlify this will timeout (26s limit). This endpoint is designed
 * to run on the VPS or be called by n8n where there's no timeout.
 * On Netlify, only use /api/remix (the initiator).
 */
export async function POST(req: NextRequest) {
  // Auth via API key (internal service calls only)
  const authHeader = req.headers.get('authorization')
  const apiKey = process.env.N8N_API_KEY ?? process.env.VPS_API_KEY
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { video_id, user_id, external_url, platform, author_name } = parsed.data
  const admin = createAdminClient()
  let localPath: string | null = null

  try {
    // ── Step 1: Download via yt-dlp ─────────────────────────────────────────
    const downloaded = await downloadVideo(external_url)
    localPath = downloaded.localPath

    // ── Step 2: Read file async ─────────────────────────────────────────────
    const fileBuffer = await readVideoFile(localPath)

    const safeTitle = downloaded.title
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 50)
    const storagePath = `${user_id}/remix_${Date.now()}_${safeTitle}.mp4`

    // ── Step 3: Upload to Supabase Storage ──────────────────────────────────
    const { error: uploadError } = await admin.storage
      .from('videos')
      .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: false })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // ── Step 4: Update video record ─────────────────────────────────────────
    await admin.from('videos').update({
      storage_path: storagePath,
      duration_seconds: Math.round(downloaded.duration),
      status: 'transcribing',
    }).eq('id', video_id)

    // ── Step 5: Transcribe ──────────────────────────────────────────────────
    const filename = storagePath.split('/').pop() ?? 'video.mp4'
    const transcription = await transcribeAudio(fileBuffer, filename)

    await admin.from('transcriptions').insert({
      video_id,
      language: transcription.language,
      full_text: transcription.full_text,
      segments: transcription.segments as unknown as Json,
      word_timestamps: transcription.word_timestamps as unknown as Json,
    })

    await admin.from('videos').update({ status: 'analyzing' }).eq('id', video_id)

    // ── Step 6: Claude skills ───────────────────────────────────────────────
    const duration = downloaded.duration
    const [hookResult, retentionResult, creditResult] = await Promise.allSettled([
      runHookHunter(transcription.full_text),
      runRetentionEditor(transcription.full_text, duration),
      runCreditManager(author_name, platform, external_url),
    ])

    const hookHunter = hookResult.status === 'fulfilled' ? hookResult.value : null
    const retentionEditor = retentionResult.status === 'fulfilled' ? retentionResult.value : null
    const credit = creditResult.status === 'fulfilled' ? creditResult.value : null

    const bestHook = hookHunter?.hooks?.[0] ?? null
    const hookStrength = bestHook?.score ?? 60
    const retentionScore = retentionEditor?.estimated_retention_score ?? 70

    const segments = retentionEditor?.segments_to_keep?.length
      ? retentionEditor.segments_to_keep
      : [{ start: 0, end: Math.min(duration, 60), reason: 'Clip complet' }]

    // ── Step 7: Create clips ────────────────────────────────────────────────
    const clipsToInsert = segments.map((seg) => ({
      video_id,
      user_id,
      title: bestHook?.text ?? downloaded.title,
      start_time: seg.start,
      end_time: seg.end,
      duration_seconds: seg.end - seg.start,
      transcript_segment: seg.reason,
      aspect_ratio: '9:16' as const,
      status: 'pending' as const,
      is_remake: true,
    }))

    const { data: insertedClips, error: clipsError } = await admin
      .from('clips')
      .insert(clipsToInsert)
      .select()

    if (clipsError || !insertedClips) throw new Error(`Clips insert failed: ${clipsError?.message}`)

    const overallScore = Math.round(hookStrength * 0.4 + retentionScore * 0.4 + 65 * 0.2)

    await admin.from('viral_scores').insert(
      insertedClips.map((clip) => ({
        clip_id: clip.id,
        score: overallScore,
        hook_strength: hookStrength,
        emotional_flow: retentionScore,
        perceived_value: 65,
        trend_alignment: 75,
        hook_type: bestHook?.type ?? null,
        explanation: bestHook?.explanation ?? 'Remix généré automatiquement',
        suggested_hooks: (hookHunter?.hooks ?? []) as unknown as Json,
      }))
    )

    await admin.from('videos').update({ status: 'clipping' }).eq('id', video_id)

    // ── Step 8: Generate FFmpeg commands ─────────────────────────────────────
    const creditText = credit?.credit_line ?? undefined
    const ffmpegCommands = insertedClips.map((clip) =>
      buildSingleSourceSplitScreen(
        `/tmp/${storagePath.split('/').pop()}`,
        `/tmp/remix_splitscreen_${clip.id}.mp4`,
        creditText,
        clip.duration_seconds ?? undefined
      )
    )

    return NextResponse.json({
      success: true,
      video_id,
      clips_count: insertedClips.length,
      ffmpeg_commands: ffmpegCommands,
    })
  } catch (err) {
    // Mark video as error
    await admin.from('videos').update({
      status: 'error',
      error_message: err instanceof Error ? err.message : 'Processing failed',
    }).eq('id', video_id)

    // Rollback quota
    await admin.rpc('decrement_video_usage', { p_user_id: user_id })

    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Processing failed',
    }, { status: 500 })
  } finally {
    if (localPath) cleanupTempFile(localPath)
  }
}
