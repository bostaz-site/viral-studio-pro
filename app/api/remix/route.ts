import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { downloadVideo, cleanupTempFile } from '@/lib/ytdlp'
import { transcribeAudio } from '@/lib/whisper'
import { runHookHunter } from '@/lib/claude/hook-hunter'
import { runRetentionEditor } from '@/lib/claude/retention-editor'
import { runCreditManager } from '@/lib/claude/credit-manager'
import { buildSingleSourceSplitScreen } from '@/lib/ffmpeg/split-screen'
import type { Json } from '@/lib/supabase/types'
import { readFileSync } from 'fs'

const bodySchema = z.object({
  trending_clip_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps invalide' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Paramètres invalides' }, { status: 400 })
  }

  const { trending_clip_id } = parsed.data

  // ── Rate limiting ───────────────────────────────────────────────────────
  const rl = rateLimit(user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
      { status: 429 }
    )
  }

  const admin = createAdminClient()

  // ── Atomic plan enforcement: check + increment video quota ──────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, monthly_videos_used')
    .eq('id', user.id)
    .single()

  const planConfig = getPlanConfig(profile?.plan)
  const maxVideos = planConfig.limits.maxVideosPerMonth

  const { data: quotaAllowed, error: rpcError } = await admin.rpc('increment_video_usage', {
    p_user_id: user.id,
    p_max_videos: maxVideos,
  })

  if (rpcError || !quotaAllowed) {
    return NextResponse.json(
      { data: null, error: 'Plan limit reached', message: `Limite atteinte : ${maxVideos === -1 ? '∞' : maxVideos} vidéos/mois sur le plan ${planConfig.name}.` },
      { status: 403 }
    )
  }

  // Fetch trending clip
  const { data: trendingClip, error: trendingError } = await admin
    .from('trending_clips')
    .select('*')
    .eq('id', trending_clip_id)
    .single()

  if (trendingError || !trendingClip) {
    return NextResponse.json({ data: null, error: 'Not found', message: 'Clip trending introuvable' }, { status: 404 })
  }

  let localPath: string | null = null

  try {
    // ── Step 1: Download via yt-dlp ───────────────────────────────────────────
    const downloaded = await downloadVideo(trendingClip.external_url)
    localPath = downloaded.localPath

    // ── Step 2: Upload to Supabase Storage ────────────────────────────────────
    const fileBuffer = readFileSync(localPath)
    const safeTitle = (trendingClip.title ?? downloaded.title)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 50)
    const storagePath = `${user.id}/remix_${Date.now()}_${safeTitle}.mp4`

    const { error: uploadError } = await admin.storage
      .from('videos')
      .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: false })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // ── Step 3: Create video record ───────────────────────────────────────────
    const videoInsert = {
      user_id: user.id,
      title: trendingClip.title ?? downloaded.title,
      source_url: trendingClip.external_url,
      source_platform: trendingClip.platform,
      storage_path: storagePath,
      duration_seconds: Math.round(downloaded.duration),
      mime_type: 'video/mp4' as const,
      status: 'transcribing' as const,
    }

    const { data: video, error: videoError } = await admin
      .from('videos')
      .insert(videoInsert)
      .select('id')
      .single()

    if (videoError || !video) throw new Error(`Video insert failed: ${videoError?.message}`)
    const videoId = video.id

    // Usage already incremented atomically via increment_video_usage RPC above

    // ── Step 4: Transcribe ────────────────────────────────────────────────────
    const filename = storagePath.split('/').pop() ?? 'video.mp4'
    const transcription = await transcribeAudio(fileBuffer, filename)

    const transcriptionInsert = {
      video_id: videoId,
      language: transcription.language,
      full_text: transcription.full_text,
      segments: transcription.segments as unknown as Json,
      word_timestamps: transcription.word_timestamps as unknown as Json,
    }

    const { data: savedTranscription } = await admin
      .from('transcriptions')
      .insert(transcriptionInsert)
      .select('id')
      .single()

    await admin.from('videos').update({ status: 'analyzing' }).eq('id', videoId)

    // ── Step 5: Claude skills + Credit Manager ────────────────────────────────
    const duration = downloaded.duration
    const [hookResult, retentionResult, creditResult] = await Promise.allSettled([
      runHookHunter(transcription.full_text),
      runRetentionEditor(transcription.full_text, duration),
      runCreditManager(
        trendingClip.author_name ?? trendingClip.author_handle ?? 'Créateur inconnu',
        trendingClip.platform,
        trendingClip.external_url
      ),
    ])

    const hookHunter     = hookResult.status === 'fulfilled'     ? hookResult.value     : null
    const retentionEditor = retentionResult.status === 'fulfilled' ? retentionResult.value : null
    const credit         = creditResult.status === 'fulfilled'   ? creditResult.value   : null

    const bestHook = hookHunter?.hooks?.[0] ?? null
    const hookStrength = bestHook?.score ?? 60
    const retentionScore = retentionEditor?.estimated_retention_score ?? 70

    const segments = retentionEditor?.segments_to_keep?.length
      ? retentionEditor.segments_to_keep
      : [{ start: 0, end: Math.min(duration, 60), reason: 'Clip complet' }]

    // ── Step 6: Create clips with credit watermark ────────────────────────────
    const creditText = credit?.credit_line ?? null

    const clipsToInsert = segments.map((seg) => ({
      video_id: videoId,
      user_id: user.id,
      title: bestHook?.text ?? trendingClip.title,
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

    await admin.from('videos').update({ status: 'clipping' }).eq('id', videoId)

    // ── Step 7: Generate split-screen FFmpeg commands ─────────────────────────
    const ffmpegCommands = insertedClips.map((clip) =>
      buildSingleSourceSplitScreen(
        `/tmp/${storagePath.split('/').pop()}`,
        `/tmp/remix_splitscreen_${clip.id}.mp4`,
        creditText ?? undefined,
        clip.duration_seconds ?? undefined
      )
    )

    return NextResponse.json({
      data: {
        video_id: videoId,
        transcription_id: savedTranscription?.id ?? null,
        clips: insertedClips,
        credit,
        ffmpeg_commands: ffmpegCommands,
        skills_used: {
          hook_hunter: hookHunter !== null,
          retention_editor: retentionEditor !== null,
          credit_manager: credit !== null,
        },
      },
      error: null,
      message: `${insertedClips.length} clip(s) remix générés depuis ${trendingClip.platform}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du remix'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  } finally {
    if (localPath) cleanupTempFile(localPath)
  }
}
