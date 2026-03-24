import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHookHunter, type HookHunterResult } from '@/lib/claude/hook-hunter'
import { runRetentionEditor, type RetentionEditorResult } from '@/lib/claude/retention-editor'
import { runCopywriterSeo, type CopywriterSeoResult } from '@/lib/claude/copywriter-seo'
import { runCreditManager, type CreditManagerResult } from '@/lib/claude/credit-manager'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { Json } from '@/lib/supabase/types'

const inputSchema = z.object({
  video_id: z.string().uuid(),
})

interface SkillResults {
  hookHunter: HookHunterResult | null
  retentionEditor: RetentionEditorResult | null
  copywriterSeo: CopywriterSeoResult | null
  creditManager: CreditManagerResult | null
}

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

    const { video_id } = parsed.data
    const admin = createAdminClient()

    // Fetch video + transcription
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

    const { data: transcription, error: transcriptionError } = await admin
      .from('transcriptions')
      .select()
      .eq('video_id', video_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (transcriptionError || !transcription) {
      return NextResponse.json(
        {
          data: null,
          error: 'Transcription not found',
          message: 'Run /api/transcribe first',
        },
        { status: 404 }
      )
    }

    await admin.from('videos').update({ status: 'analyzing' }).eq('id', video_id)

    // Run 4 Claude skills in parallel
    const videoDuration = video.duration_seconds ?? 300
    const isRemake =
      video.source_url !== null &&
      video.source_platform !== null &&
      video.source_platform !== 'upload'

    const [hookResult, retentionResult, copywriterResult, creditResult] =
      await Promise.allSettled([
        runHookHunter(transcription.full_text),
        runRetentionEditor(transcription.full_text, videoDuration),
        runCopywriterSeo(transcription.full_text),
        isRemake && video.source_url
          ? runCreditManager(
              video.title ?? 'Créateur inconnu',
              video.source_platform ?? 'unknown',
              video.source_url
            )
          : Promise.resolve(null),
      ])

    const skills: SkillResults = {
      hookHunter: hookResult.status === 'fulfilled' ? hookResult.value : null,
      retentionEditor: retentionResult.status === 'fulfilled' ? retentionResult.value : null,
      copywriterSeo: copywriterResult.status === 'fulfilled' ? copywriterResult.value : null,
      creditManager: creditResult.status === 'fulfilled' ? creditResult.value : null,
    }

    // Determine clip segments from Retention Editor, fallback to full video
    const segments =
      skills.retentionEditor?.segments_to_keep && skills.retentionEditor.segments_to_keep.length > 0
        ? skills.retentionEditor.segments_to_keep
        : [{ start: 0, end: Math.min(videoDuration, 60), reason: 'Clip complet' }]

    const bestHook = skills.hookHunter?.hooks?.[0] ?? null
    const retentionScore = skills.retentionEditor?.estimated_retention_score ?? 70

    // Create clip records
    const clipsToInsert = segments.map((seg) => ({
      video_id,
      user_id: user.id,
      title: bestHook ? bestHook.text : video.title,
      start_time: seg.start,
      end_time: seg.end,
      duration_seconds: seg.end - seg.start,
      transcript_segment: seg.reason,
      aspect_ratio: '9:16',
      status: 'pending' as const,
      is_remake: isRemake,
    }))

    const { data: insertedClips, error: clipsError } = await admin
      .from('clips')
      .insert(clipsToInsert)
      .select()

    if (clipsError || !insertedClips) {
      await admin
        .from('videos')
        .update({ status: 'error', error_message: clipsError?.message })
        .eq('id', video_id)
      return NextResponse.json(
        { data: null, error: clipsError?.message, message: 'Failed to save clips' },
        { status: 500 }
      )
    }

    // Create viral scores for each clip
    const hookStrength = bestHook?.score ?? 60
    const overallScore = Math.round((hookStrength * 0.4 + retentionScore * 0.4 + 60 * 0.2))

    const viralScoresToInsert = insertedClips.map((clip) => ({
      clip_id: clip.id,
      score: overallScore,
      hook_strength: hookStrength,
      emotional_flow: retentionScore,
      perceived_value: 65,
      trend_alignment: 55,
      hook_type: bestHook?.type ?? null,
      explanation: bestHook?.explanation ?? 'Clip généré automatiquement par IA',
      suggested_hooks: (skills.hookHunter?.hooks ?? []) as unknown as Json,
    }))

    await admin.from('viral_scores').insert(viralScoresToInsert)

    // Update video status to clipping
    await admin.from('videos').update({ status: 'clipping' }).eq('id', video_id)

    return NextResponse.json({
      data: {
        clips: insertedClips,
        skills_used: {
          hook_hunter: skills.hookHunter !== null,
          retention_editor: skills.retentionEditor !== null,
          copywriter_seo: skills.copywriterSeo !== null,
          credit_manager: skills.creditManager !== null,
        },
        captions: skills.copywriterSeo,
        credit: skills.creditManager,
      },
      error: null,
      message: `${insertedClips.length} clip(s) generated successfully`,
    })
  } catch (error) {
    return NextResponse.json(
      { data: null, error: String(error), message: 'Internal server error' },
      { status: 500 }
    )
  }
}
